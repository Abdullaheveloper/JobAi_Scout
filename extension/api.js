// api.js - Supabase Auth & Profile API
import { storage } from "./storage.js";

const SUPABASE_URL = "https://okppdziaslsitmoqduqg.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rcHBkemlhc2xzaXRtb3FkdXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NzE3MTUsImV4cCI6MjA4ODU0NzcxNX0.yAFcwtZL8P2W-gN8ZyBik_CSA8c84cgBo9qJYouvPkc";

async function makeRequest(url, opts = {}) {
  const headers = { "Content-Type": "application/json", "apikey": ANON_KEY, ...(opts.headers || {}) };
  let res;
  try {
    res = await fetch(url, { ...opts, headers });
  } catch (networkErr) {
    throw new Error("Network error: " + (networkErr.message || "Failed to connect."));
  }
  const text = await res.text().catch(() => "");
  let json;
  try { json = text ? JSON.parse(text) : {}; }
  catch {
    if (!res.ok) throw new Error(`Server error (HTTP ${res.status})`);
    json = {};
  }
  if (!res.ok) {
    const msg = json.error_description || json.msg || json.message || json.error || (typeof json === "string" ? json : null) || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

let _refreshPromise = null;

export const api = {
  SUPABASE_URL,
  ANON_KEY,

  async signIn(email, password) {
    await storage.removeSession();
    const data = await makeRequest(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (!data.access_token) throw new Error("Login failed: no access token received.");
    const session = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
      user: data.user,
    };
    await storage.setSession(session);
    return session;
  },

  async signInWithGoogle() {
    if (!chrome?.identity?.getRedirectURL || !chrome?.identity?.launchWebAuthFlow) {
      throw new Error("Google login needs Chrome identity permission.");
    }
    const redirectUrl = chrome.identity.getRedirectURL();
    const authUrl = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectUrl)}`;
    const callbackUrl = await new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, (responseUrl) => {
        const err = chrome.runtime.lastError;
        if (err) reject(new Error(err.message));
        else if (!responseUrl) reject(new Error("Google login was cancelled"));
        else resolve(responseUrl);
      });
    });
    const parsed = new URL(callbackUrl);
    const params = new URLSearchParams(parsed.hash.slice(1));
    parsed.searchParams.forEach((v, k) => params.set(k, v));
    if (params.get("error")) throw new Error(params.get("error_description") || params.get("error"));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    if (!accessToken || !refreshToken) throw new Error("Google login did not return a session");
    const userData = await makeRequest(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { "Authorization": `Bearer ${accessToken}` }
    });
    const session = {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: Math.floor(Date.now() / 1000) + Number(params.get("expires_in") || 3600),
      user: userData
    };
    await storage.setSession(session);
    return session;
  },

  async refreshIfNeeded() {
    if (_refreshPromise) {
      try { return await _refreshPromise; }
      catch { return await storage.getSession(); }
    }
    const session = await storage.getSession();
    if (!session) return null;
    if (!session.access_token || !session.user) {
      await storage.removeSession();
      return null;
    }
    const now = Math.floor(Date.now() / 1000);
    if (session.expires_at && (session.expires_at - 60) > now) return session;
    if (!session.refresh_token) {
      await storage.removeSession();
      return null;
    }
    _refreshPromise = this._doRefresh(session);
    try {
      const newSession = await _refreshPromise;
      return newSession;
    } catch (e) {
      if (e.message.includes("Network error")) return session;
      await storage.removeSession();
      return null;
    } finally { _refreshPromise = null; }
  },

  async _doRefresh(session) {
    const data = await makeRequest(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    if (!data.access_token) throw new Error("Refresh returned no access token");
    const next = {
      access_token: data.access_token,
      refresh_token: data.refresh_token || session.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
      user: data.user || session.user
    };
    await storage.setSession(next);
    return next;
  },

  async getProfile(session) {
    try {
      const profilesArr = await makeRequest(
        `${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${encodeURIComponent(session.user.id)}&select=*`,
        { headers: { "Authorization": `Bearer ${session.access_token}` } }
      );
      const profile = Array.isArray(profilesArr) && profilesArr[0] ? profilesArr[0] : {};
      return { id: session.user.id, ...profile };
    } catch (e) {
      console.warn("[api] Profile fetch failed:", e.message);
      return { id: session.user.id, email: session.user.email };
    }
  },

  async saveProfilePatch(session, payload) {
    return makeRequest(
      `${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${encodeURIComponent(session.user.id)}`,
      {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Prefer": "return=representation"
        },
        body: JSON.stringify(payload)
      }
    );
  },

  async trackUsage(email, fields, pageUrl) {
    return makeRequest(`${SUPABASE_URL}/functions/v1/track-extension-usage`, {
      method: "POST",
      body: JSON.stringify({ email, fields, page_url: pageUrl })
    }).catch(() => {});
  }
};
