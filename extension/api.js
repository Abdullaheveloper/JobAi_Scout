// api.js - Extension API client communicating with Supabase Edge Functions & REST APIs
import { storage } from "./storage.js";

const SUPABASE_URL = "https://okppdziaslsitmoqduqg.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rcHBkemlhc2xzaXRtb3FkdXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NzE3MTUsImV4cCI6MjA4ODU0NzcxNX0.yAFcwtZL8P2W-gN8ZyBik_CSA8c84cgBo9qJYouvPkc";

// ── Robust fetch wrapper ──
// Handles non-JSON error bodies, network errors, and token expiry
async function makeRequest(url, opts = {}) {
  const headers = { "Content-Type": "application/json", "apikey": ANON_KEY, ...(opts.headers || {}) };
  let res;
  try {
    res = await fetch(url, { ...opts, headers });
  } catch (networkErr) {
    throw new Error("Network error: " + (networkErr.message || "Failed to connect to server. Check your internet."));
  }

  // Handle empty responses (e.g. 204 No Content from DELETE)
  const text = await res.text().catch(() => "");
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    if (!res.ok) {
      throw new Error(`Server error (HTTP ${res.status})`);
    }
    json = {};
  }

  if (!res.ok) {
    const msg = json.error_description
      || json.msg
      || json.message
      || json.error
      || (typeof json === "string" ? json : null)
      || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

// ── Refresh mutex ──
// Prevents multiple simultaneous refreshes from racing and invalidating each other
let _refreshPromise = null;

export const api = {
  SUPABASE_URL,
  ANON_KEY,

  // ── Sign In (email + password) ──
  async signIn(email, password) {
    // Clear any stale session first
    await storage.removeSession();

    const data = await makeRequest(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    if (!data.access_token) {
      throw new Error("Login failed: no access token received. Check your email and password.");
    }

    const session = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
      user: data.user,
    };
    await storage.setSession(session);
    return session;
  },

  // ── Sign In with Google (OAuth) ──
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

  // ── Refresh If Needed (with mutex to prevent race conditions) ──
  // Multiple callers can call this simultaneously; only one refresh will run.
  async refreshIfNeeded() {
    // If a refresh is already in progress, wait for it
    if (_refreshPromise) {
      try {
        return await _refreshPromise;
      } catch {
        // The in-flight refresh failed; fall through to try again or return null
        return await storage.getSession();
      }
    }

    const session = await storage.getSession();
    if (!session) return null;

    // Validate session object shape
    if (!session.access_token || !session.user) {
      console.warn("[api] Corrupt session (missing access_token or user), clearing.");
      await storage.removeSession();
      return null;
    }

    // If token is still valid (60s buffer), use it as-is
    const now = Math.floor(Date.now() / 1000);
    if (session.expires_at && (session.expires_at - 60) > now) {
      return session;
    }

    // Token expired — need to refresh. Use mutex to prevent races.
    if (!session.refresh_token) {
      console.warn("[api] Token expired and no refresh_token. Clearing session.");
      await storage.removeSession();
      return null;
    }

    _refreshPromise = this._doRefresh(session);
    try {
      const newSession = await _refreshPromise;
      return newSession;
    } catch (e) {
      console.warn("[api] Token refresh failed:", e.message);
      // Only clear session if the error is an auth error (4xx), not a network glitch
      if (e.message.includes("Network error")) {
        // Network glitch — keep the session, user might come back online
        console.warn("[api] Keeping session despite network error.");
        return session;
      }
      await storage.removeSession();
      return null;
    } finally {
      _refreshPromise = null;
    }
  },

  // Internal: performs the actual token refresh
  async _doRefresh(session) {
    const data = await makeRequest(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });

    if (!data.access_token) {
      throw new Error("Refresh returned no access token");
    }

    const next = {
      access_token: data.access_token,
      refresh_token: data.refresh_token || session.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
      user: data.user || session.user
    };
    await storage.setSession(next);
    return next;
  },

  // ── Profile Retrieval (direct REST query, no edge function dependency) ──
  async getProfile(session) {
    try {
      const [profilesArr, prefsArr] = await Promise.all([
        makeRequest(`${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${encodeURIComponent(session.user.id)}&select=*`, {
          headers: { "Authorization": `Bearer ${session.access_token}` }
        }),
        makeRequest(`${SUPABASE_URL}/rest/v1/job_preferences?user_id=eq.${encodeURIComponent(session.user.id)}&select=*`, {
          headers: { "Authorization": `Bearer ${session.access_token}` }
        }).catch(() => [])
      ]);

      const profile = Array.isArray(profilesArr) && profilesArr[0] ? profilesArr[0] : {};
      const pref = Array.isArray(prefsArr) && prefsArr[0] ? prefsArr[0] : {};

      let experience = "Mid Level";
      if (profile.experience_years !== undefined && profile.experience_years !== null) {
        const years = Number(profile.experience_years);
        if (years <= 2) experience = "Entry Level";
        else if (years <= 5) experience = "Mid Level";
        else experience = "Senior";
      }

      return {
        id: session.user.id,
        skills: profile.skills || pref.skills || [],
        desired_role: pref.desired_role || (profile.desired_roles && profile.desired_roles[0]) || "",
        location: profile.location || (pref.preferred_locations && pref.preferred_locations[0]) || "",
        experience,
        job_type: pref.job_type || "Full Time",
        ...profile
      };
    } catch (e) {
      console.warn("[api] Profile query failed:", e.message);
      return {
        id: session.user.id,
        email: session.user.email,
        skills: [],
        desired_role: "",
        location: "",
        experience: "Mid Level",
        job_type: "Full Time"
      };
    }
  },

  // ── Upload Discovered Job ──
  async uploadDiscoveredJob(session, job) {
    const userId = encodeURIComponent(session.user.id);

    // Dedup by URL
    if (job.job_url) {
      try {
        const existing = await makeRequest(
          `${SUPABASE_URL}/rest/v1/recommended_jobs?user_id=eq.${userId}&source_url=eq.${encodeURIComponent(job.job_url)}&select=id`,
          { headers: { "Authorization": `Bearer ${session.access_token}` } }
        );
        if (Array.isArray(existing) && existing.length > 0) {
          return { success: false, error: "Duplicate job (same URL)", is_duplicate: true };
        }
      } catch (e) {
        console.warn("[api] Dedup check failed:", e.message);
      }
    }

    // Dedup by company + title
    if (job.title && job.company) {
      try {
        const existing = await makeRequest(
          `${SUPABASE_URL}/rest/v1/recommended_jobs?user_id=eq.${userId}&title=eq.${encodeURIComponent(job.title)}&company=eq.${encodeURIComponent(job.company)}&select=id`,
          { headers: { "Authorization": `Bearer ${session.access_token}` } }
        );
        if (Array.isArray(existing) && existing.length > 0) {
          return { success: false, error: "Duplicate job (same title+company)", is_duplicate: true };
        }
      } catch (e) {
        console.warn("[api] Dedup by title+company failed:", e.message);
      }
    }

    const payload = {
      user_id: session.user.id,
      title: job.title,
      company: job.company,
      company_logo: job.company_logo || null,
      location: job.location || null,
      description: job.description || null,
      salary: job.salary || null,
      employment_type: job.employment_type || null,
      experience_required: job.experience_required || null,
      skills_required: Array.isArray(job.skills_required) ? job.skills_required : [],
      source_portal: job.source || job.source_portal || "unknown",
      source_url: job.job_url || job.source_url || null,
      match_score: job.match_score || 0,
      match_explanation: job.match_explanation || {},
      posted_date: job.posted_date || null,
      synced_at: new Date().toISOString()
    };

    try {
      const insertRes = await makeRequest(`${SUPABASE_URL}/rest/v1/recommended_jobs`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Prefer": "return=representation"
        },
        body: JSON.stringify(payload)
      });
      return { success: true, job: Array.isArray(insertRes) ? insertRes[0] : insertRes };
    } catch (e) {
      const errMsg = e.message || "";
      const colMatch = errMsg.match(/column\s+"([^"]+)"/i) || errMsg.match(/'([^']+)'\s+column/i);
      if (colMatch && colMatch[1] in payload) {
        delete payload[colMatch[1]];
        try {
          const retryRes = await makeRequest(`${SUPABASE_URL}/rest/v1/recommended_jobs`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${session.access_token}`,
              "Prefer": "return=representation"
            },
            body: JSON.stringify(payload)
          });
          return { success: true, job: Array.isArray(retryRes) ? retryRes[0] : retryRes };
        } catch (retryErr) {
          return { success: false, error: retryErr.message };
        }
      }
      return { success: false, error: e.message };
    }
  },

  // ── GET Recommended Jobs ──
  async getRecommendedJobs(session) {
    try {
      const jobs = await makeRequest(
        `${SUPABASE_URL}/rest/v1/recommended_jobs?user_id=eq.${encodeURIComponent(session.user.id)}&select=*&order=match_score.desc`,
        { headers: { "Authorization": `Bearer ${session.access_token}` } }
      );
      return (jobs || []).map((j) => ({
        id: j.id,
        title: j.title,
        company: j.company,
        location: j.location || "",
        match_score: j.match_score || 0,
        job_url: j.source_url || "",
        source: j.source_portal || "unknown",
        source_portal: j.source_portal || "unknown",
        source_url: j.source_url || "",
        salary: j.salary || "",
        employment_type: j.employment_type || "",
        skills_required: j.skills_required || [],
        synced_at: j.synced_at || j.created_at || ""
      }));
    } catch (e) {
      console.warn("[api] Get recommended jobs failed:", e.message);
      return [];
    }
  },

  // ── Profile Updates ──
  async saveProfilePatch(session, payload) {
    const userId = encodeURIComponent(session.user.id);
    const headers = {
      "Content-Type": "application/json",
      "apikey": ANON_KEY,
      "Authorization": `Bearer ${session.access_token}`,
      "Prefer": "return=representation",
    };
    const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${userId}&select=*`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
    return data;
  },

  // ── Analytics ──
  async trackUsage(email, fields, pageUrl) {
    return makeRequest(`${SUPABASE_URL}/functions/v1/track-extension-usage`, {
      method: "POST",
      body: JSON.stringify({ email, fields, page_url: pageUrl })
    }).catch(() => {});
  },

  async trackApplied(session, payload) {
    return makeRequest(`${SUPABASE_URL}/functions/v1/track-applied-job`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${session.access_token}` },
      body: JSON.stringify({ ...payload, status: "applied" })
    }).catch(() => {});
  },

  async recordScanHistory(session, portal, found, matched, synced) {
    return makeRequest(`${SUPABASE_URL}/rest/v1/scan_history`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${session.access_token}`,
        "Prefer": "return=representation"
      },
      body: JSON.stringify({
        user_id: session.user.id,
        portal,
        jobs_found: found,
        jobs_matched: matched,
        jobs_synced: synced,
        scanned_at: new Date().toISOString()
      })
    }).catch((e) => {
      console.warn("[api] recordScanHistory failed:", e.message);
    });
  }
};
