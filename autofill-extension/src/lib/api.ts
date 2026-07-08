import { z } from "zod";
import { API_BASE, ANON_KEY, STORAGE_KEYS } from "./constants";
import {
  LoginResponseSchema,
  ProfileResponseSchema,
  type AuthSession,
  type UserProfile,
} from "./types";

// ── Storage helpers ──
async function getAuth(): Promise<AuthSession | null> {
  const res = await chrome.storage.local.get(STORAGE_KEYS.AUTH);
  return res[STORAGE_KEYS.AUTH] || null;
}

async function setAuth(session: AuthSession): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.AUTH]: session });
}

async function clearAuth(): Promise<void> {
  await chrome.storage.local.remove([STORAGE_KEYS.AUTH, STORAGE_KEYS.PROFILE]);
}

async function getCachedProfile(): Promise<UserProfile | null> {
  const res = await chrome.storage.local.get(STORAGE_KEYS.PROFILE);
  return res[STORAGE_KEYS.PROFILE] || null;
}

async function setCachedProfile(profile: UserProfile): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.PROFILE]: profile });
}

// ── Fetch wrapper ──
async function request<T>(
  path: string,
  options: RequestInit = {},
  session?: AuthSession | null
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: ANON_KEY,
    ...(options.headers as Record<string, string>),
  };
  if (session?.token) {
    headers["Authorization"] = `Bearer ${session.token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    if (!res.ok) throw new Error(`Server error (HTTP ${res.status})`);
    json = {};
  }

  if (!res.ok) {
    const obj = json as Record<string, unknown>;
    const msg =
      (obj.error_description as string) ||
      (obj.message as string) ||
      (obj.error as string) ||
      `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return json as T;
}

// ── Auth API ──
export async function signIn(
  email: string,
  password: string
): Promise<AuthSession> {
  await clearAuth();

  const data = await request<unknown>(
    "/auth/v1/token?grant_type=password",
    {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }
  );

  const parsed = LoginResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("Login failed: invalid response from server");
  }

  const session: AuthSession = {
    token: parsed.data.token,
    refreshToken: parsed.data.refreshToken,
    userId: parsed.data.userId,
    expiresAt: Date.now() + 3600_000,
  };

  await setAuth(session);
  return session;
}

export async function refreshSession(
  session: AuthSession
): Promise<AuthSession | null> {
  try {
    const data = await request<unknown>(
      "/auth/v1/token?grant_type=refresh_token",
      {
        method: "POST",
        body: JSON.stringify({ refresh_token: session.refreshToken }),
      }
    );

    const parsed = LoginResponseSchema.safeParse(data);
    if (!parsed.success) return null;

    const next: AuthSession = {
      token: parsed.data.token,
      refreshToken: parsed.data.refreshToken,
      userId: parsed.data.userId,
      expiresAt: Date.now() + 3600_000,
    };
    await setAuth(session);
    return next;
  } catch {
    return null;
  }
}

export async function getValidSession(): Promise<AuthSession | null> {
  const session = await getAuth();
  if (!session) return null;

  // Token still valid (with 60s buffer)
  if (session.expiresAt - 60_000 > Date.now()) return session;

  // Try refresh
  const refreshed = await refreshSession(session);
  if (refreshed) return refreshed;

  await clearAuth();
  return null;
}

export async function logout(): Promise<void> {
  await clearAuth();
}

// ── Profile API ──
export async function fetchProfile(
  session: AuthSession
): Promise<UserProfile> {
  const data = await request<unknown>(
    `/rest/v1/profiles?user_id=eq.${encodeURIComponent(session.userId)}&select=*`,
    {},
    session
  );

  const arr = Array.isArray(data) ? data : [data];
  const raw = arr[0] || {};

  const parsed = ProfileResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("Profile data validation failed");
  }

  const p = parsed.data;
  const profile: UserProfile = {
    name: p.name || "",
    email: p.email || session.userId,
    phone: p.phone || "",
    address: p.address || "",
    country: p.country || "",
    city: p.city || "",
    postalCode: p.postalCode || "",
    linkedin: p.linkedin || "",
    github: p.github || "",
    portfolio: p.portfolio || "",
    experienceYears: p.experienceYears || 0,
    currentCompany: p.currentCompany || "",
    currentRole: p.currentRole || "",
    noticePeriod: p.noticePeriod || "",
    expectedSalary: p.expectedSalary || "",
    skills: Array.isArray(p.skills) ? p.skills : [],
    education: Array.isArray(p.education) ? p.education : [],
    projects: Array.isArray(p.projects) ? p.projects : [],
  };

  await setCachedProfile(profile);
  return profile;
}

export async function loadProfile(
  forceRefresh = false
): Promise<UserProfile | null> {
  if (!forceRefresh) {
    const cached = await getCachedProfile();
    if (cached) return cached;
  }

  const session = await getValidSession();
  if (!session) return null;

  try {
    return await fetchProfile(session);
  } catch {
    return await getCachedProfile();
  }
}

export { getAuth, setAuth, clearAuth, getCachedProfile, setCachedProfile };
