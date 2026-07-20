// api.js - Supabase Auth & Profile API
import { storage } from "./storage.js";

let configPromise = null;

async function getConfig() {
  if (!configPromise) {
    configPromise = (async () => {
      const url = chrome?.runtime?.getURL?.("config.local.json");
      if (!url) throw new Error("JobAI extension configuration is unavailable.");
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Extension connection is not configured. Run npm run extension:config, then reload the extension.");
      }
      const config = await response.json();
      if (!config?.supabaseUrl || !config?.anonKey) {
        throw new Error("Extension connection is incomplete. Run npm run extension:config, then reload the extension.");
      }
      return config;
    })();
  }
  return configPromise;
}

async function makeRequest(url, opts = {}) {
  const { anonKey } = await getConfig();
  const headers = { "Content-Type": "application/json", "apikey": anonKey, ...(opts.headers || {}) };
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
  async signIn(email, password) {
    const { supabaseUrl } = await getConfig();
    await storage.removeSession();
    const data = await makeRequest(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
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
    const { supabaseUrl } = await getConfig();
    const redirectUrl = chrome.identity.getRedirectURL();
    const authUrl = `${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectUrl)}`;
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
    const userData = await makeRequest(`${supabaseUrl}/auth/v1/user`, {
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
    const { supabaseUrl } = await getConfig();
    const data = await makeRequest(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
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
      const { supabaseUrl } = await getConfig();
      const response = await makeRequest(
        `${supabaseUrl}/functions/v1/extension-profile`,
        {
          method: "POST",
          headers: { "Authorization": `Bearer ${session.access_token}` },
          body: JSON.stringify({}),
        },
      );
      const profile = response.profile || {};
      return {
        id: session.user.id,
        user_id: session.user.id,
        ...profile,
        email: profile.email || session.user.email,
      };
    } catch (e) {
      console.warn("[api] Profile fetch failed:", e.message);
      return { id: session.user.id, email: session.user.email };
    }
  },

  async downloadProfileFile(session, filePath, bucket = "resumes") {
    const { supabaseUrl, anonKey } = await getConfig();
    if (!["resumes", "profile-assets"].includes(bucket)) {
      throw new Error("This private file location is not supported.");
    }
    const normalizedPath = String(filePath || "").replace(/\\/g, "/").replace(/^\/+/, "");
    if (!normalizedPath || !normalizedPath.startsWith(`${session.user.id}/`)) {
      throw new Error("This document does not belong to the signed-in account.");
    }
    const response = await fetch(
      `${supabaseUrl}/storage/v1/object/${bucket}/${normalizedPath}`,
      { headers: { Authorization: `Bearer ${session.access_token}`, apikey: anonKey } },
    );
    if (!response.ok) throw new Error("Could not download the document from your private profile.");
    return { blob: await response.blob(), contentType: response.headers.get("content-type") || "application/pdf" };
  },

  async downloadResume(session, filePath) {
    return this.downloadProfileFile(session, filePath, "resumes");
  },

  async uploadResume(session, file) {
    if (!(file instanceof Blob)) throw new Error("Choose a PDF or DOCX resume.");
    const originalName = String(file.name || "resume.pdf");
    const extension = originalName.toLowerCase().match(/\.(pdf|docx)$/)?.[1];
    if (!extension) throw new Error("Only PDF and DOCX resumes are supported.");
    if (file.size <= 0 || file.size > 10 * 1024 * 1024) {
      throw new Error("Resume must be smaller than 10 MB.");
    }

    const { supabaseUrl, anonKey } = await getConfig();
    const safeBaseName = originalName
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 70) || "resume";
    const filePath = `${session.user.id}/${Date.now()}_${safeBaseName}.${extension}`;
    const encodedPath = filePath.split("/").map(encodeURIComponent).join("/");
    const upload = await fetch(`${supabaseUrl}/storage/v1/object/resumes/${encodedPath}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: anonKey,
        "Content-Type": file.type || (extension === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
        "x-upsert": "false",
      },
      body: file,
    });
    if (!upload.ok) {
      const details = await upload.json().catch(() => ({}));
      throw new Error(details.message || details.error || "Could not upload the resume.");
    }

    await this.saveProfilePatch(session, { resume_url: filePath });
    return { filePath, fileName: originalName, size: file.size };
  },

  async uploadProfileImage(session, file) {
    if (!(file instanceof Blob)) throw new Error("Choose a JPG, PNG, or WEBP image.");
    const originalName = String(file.name || "profile.jpg");
    const extension = originalName.toLowerCase().match(/\.(jpe?g|png|webp)$/)?.[1];
    if (!extension) throw new Error("Only JPG, PNG, and WEBP images are supported.");
    if (file.size <= 0 || file.size > 5 * 1024 * 1024) {
      throw new Error("Profile image must be smaller than 5 MB.");
    }
    const allowedTypes = new Set(["", "image/jpeg", "image/png", "image/webp"]);
    if (!allowedTypes.has(String(file.type || "").toLowerCase())) {
      throw new Error("The selected file is not a supported profile image.");
    }

    const { supabaseUrl, anonKey } = await getConfig();
    const normalizedExtension = extension === "jpeg" ? "jpg" : extension;
    const filePath = `${session.user.id}/${Date.now()}_profile.${normalizedExtension}`;
    const encodedPath = filePath.split("/").map(encodeURIComponent).join("/");
    const contentType = file.type || (normalizedExtension === "png" ? "image/png" : normalizedExtension === "webp" ? "image/webp" : "image/jpeg");
    const upload = await fetch(`${supabaseUrl}/storage/v1/object/profile-assets/${encodedPath}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: anonKey,
        "Content-Type": contentType,
        "x-upsert": "false",
      },
      body: file,
    });
    if (!upload.ok) {
      const details = await upload.json().catch(() => ({}));
      throw new Error(details.message || details.error || "Could not upload the profile image.");
    }

    await this.saveProfilePatch(session, { avatar_url: filePath });
    return { filePath, fileName: originalName, size: file.size };
  },

  async saveProfilePatch(session, payload) {
    const { supabaseUrl } = await getConfig();
    return makeRequest(
      `${supabaseUrl}/rest/v1/profiles?user_id=eq.${encodeURIComponent(session.user.id)}`,
      {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Prefer": "return=representation"
        },
        body: JSON.stringify(payload)
      }
    );
  }
};
