const SUPABASE_URL = "https://okppdziaslsitmoqduqg.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rcHBkemlhc2xzaXRtb3FkdXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NzE3MTUsImV4cCI6MjA4ODU0NzcxNX0.yAFcwtZL8P2W-gN8ZyBik_CSA8c84cgBo9qJYouvPkc";
const TRACK_USAGE_URL = `${SUPABASE_URL}/functions/v1/track-extension-usage`;
const SECURITY_ALERT_URL = `${SUPABASE_URL}/functions/v1/security-alert`;
const TRACK_APPLIED_URL = `${SUPABASE_URL}/functions/v1/track-applied-job`;

const $ = (id) => document.getElementById(id);
const setStatus = (msg, err=false) => { const s=$("status"); s.textContent=msg||""; s.className="status"+(err?" err":""); };
const FIELD_LABELS = {
  email: "Email address",
  phone: "Phone number",
  first_name: "First name",
  last_name: "Last name",
  full_name: "Full name",
  linkedin_url: "LinkedIn URL",
  github_url: "GitHub URL",
  portfolio_url: "Portfolio URL",
  current_company: "Current company",
  experience_years: "Years of experience",
  desired_roles: "Desired roles",
  cv_summary: "CV summary",
  bio: "Bio",
  expected_salary: "Expected salary",
  linkedin: "LinkedIn URL",
  github: "GitHub URL",
  portfolio: "Portfolio URL",
  location: "Location",
  company: "Current company",
  experience: "Years of experience",
  summary: "Profile summary / bio",
  skills: "Skills",
  salary: "Expected salary",
};

const PROFILE_COMPLETION_FIELDS = [
  { key: "full_name", label: "Full name", type: "text" },
  { key: "email", label: "Email address", type: "email" },
  { key: "phone", label: "Phone number", type: "tel" },
  { key: "location", label: "Location", type: "text" },
  { key: "linkedin_url", label: "LinkedIn URL", type: "url" },
  { key: "github_url", label: "GitHub URL", type: "url" },
  { key: "portfolio_url", label: "Portfolio URL", type: "url" },
  { key: "current_company", label: "Current company", type: "text" },
  { key: "experience_years", label: "Years of experience", type: "number" },
  { key: "skills", label: "Skills", type: "textarea", hint: "Separate skills with commas" },
  { key: "desired_roles", label: "Desired roles", type: "textarea", hint: "Separate roles with commas" },
  { key: "cv_summary", label: "CV summary", type: "textarea" },
  { key: "bio", label: "Bio", type: "textarea" },
  { key: "expected_salary", label: "Expected salary", type: "text" },
];

const PROFILE_COMPLETION_KEYS = PROFILE_COMPLETION_FIELDS.map((field) => field.key);

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}

function normalizeProfile(profile, session) {
  const next = { ...(profile || {}) };
  if (!next.user_id && session?.user?.id) next.user_id = session.user.id;
  if (!next.email && session?.user?.email) next.email = session.user.email;
  return next;
}

function hasProfileValue(profile, key) {
  const value = profile?.[key];
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  return String(value ?? "").trim().length > 0;
}

function missingProfileFields(profile) {
  return PROFILE_COMPLETION_FIELDS.filter((field) => !hasProfileValue(profile, field.key));
}

async function api(path, opts={}) {
  const headers = { "Content-Type": "application/json", "apikey": ANON_KEY, ...(opts.headers||{}) };
  const res = await fetch(`${SUPABASE_URL}${path}`, { ...opts, headers });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error_description || json.msg || json.error || `HTTP ${res.status}`);
  return json;
}

async function signIn(email, password) {
  const data = await api("/auth/v1/token?grant_type=password", {
    method: "POST", body: JSON.stringify({ email, password }),
  });
  const session = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Math.floor(Date.now()/1000) + (data.expires_in||3600),
    user: data.user,
  };
  await chrome.storage.local.set({ session });
  return session;
}

function parseAuthCallback(url) {
  const parsed = new URL(url);
  const params = new URLSearchParams(parsed.hash.slice(1));
  parsed.searchParams.forEach((value, key) => params.set(key, value));
  if (params.get("error") || params.get("error_description")) {
    throw new Error(params.get("error_description") || params.get("error") || "Google login failed");
  }
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) throw new Error("Google login did not return a session");
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: Math.floor(Date.now() / 1000) + Number(params.get("expires_in") || 3600),
  };
}

async function fetchAuthUser(accessToken) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { "apikey": ANON_KEY, "Authorization": `Bearer ${accessToken}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error_description || json.msg || json.error || "Could not load Google user");
  return json;
}

async function signInWithGoogle() {
  if (!chrome?.identity?.getRedirectURL || !chrome?.identity?.launchWebAuthFlow) {
    throw new Error("Google login needs the Chrome identity permission. Reload the unpacked extension from chrome://extensions, or sign in with email and password.");
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
  const session = parseAuthCallback(callbackUrl);
  session.user = await fetchAuthUser(session.access_token);
  await chrome.storage.local.set({ session });
  return session;
}

async function refreshIfNeeded() {
  const { session } = await chrome.storage.local.get("session");
  if (!session) return null;
  if (session.expires_at - 60 > Math.floor(Date.now()/1000)) return session;
  try {
    const data = await api("/auth/v1/token?grant_type=refresh_token", {
      method: "POST", body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    const next = { access_token:data.access_token, refresh_token:data.refresh_token,
      expires_at: Math.floor(Date.now()/1000)+(data.expires_in||3600), user:data.user };
    await chrome.storage.local.set({ session: next });
    return next;
  } catch { await chrome.storage.local.remove("session"); return null; }
}

async function fetchProfile(session) {
  const userId = encodeURIComponent(session.user.id);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${userId}&select=*`, {
    headers: { "apikey": ANON_KEY, "Authorization": `Bearer ${session.access_token}` },
  });
  const arr = await res.json();
  if (!res.ok) throw new Error(arr.message || arr.error || `Profile load failed: HTTP ${res.status}`);
  return normalizeProfile(Array.isArray(arr) && arr[0] ? arr[0] : null, session);
}

function renderProfile(session, p) {
  const profile = normalizeProfile(p, session);
  $("loginGate").style.display = "none";
  $("profile").style.display = "block";
  $("fillBtn").style.display = "block";
  $("logoutBtn").style.display = "block";
  const skillsValue = normalizeList(profile.skills).join(", ");
  const skills = skillsValue || "-";
  $("profile").innerHTML = `
    <div class="row"><span>Signed in</span><span>${escapeHtml(session.user.email)}</span></div>
    <div class="row"><span>Name</span><span>${escapeHtml(profile.full_name || "-")}</span></div>
    <div class="row"><span>Phone</span><span>${escapeHtml(profile.phone || "-")}</span></div>
    <div class="row"><span>Location</span><span>${escapeHtml(profile.location || "-")}</span></div>
    <div class="row"><span>Skills</span><span title="${escapeHtml(skills)}">${escapeHtml(skills)}</span></div>
  `;
}

async function loadAndRenderProfile(session) {
  const profile = await fetchProfile(session);
  await chrome.storage.local.set({ profile });
  renderProfile(session, profile);
  renderCompletionPopup(session, profile);
  setStatus("Profile loaded");
  return profile;
}

function renderCompletionPopup(session, profile) {
  const box = $("completionPopup");
  const normalized = normalizeProfile(profile, session);
  const missing = missingProfileFields(normalized);
  if (!missing.length) {
    box.style.display = "none";
    box.innerHTML = "";
    return;
  }

  const controls = missing.map((field) => {
    const value = field.key === "email" ? (session.user.email || "") : "";
    const safeKey = escapeHtml(field.key);
    const safeLabel = escapeHtml(field.label);
    const safeValue = escapeHtml(value);
    const hint = field.hint ? `<div class="hint">${escapeHtml(field.hint)}</div>` : "";
    if (field.type === "textarea") {
      return `<label for="complete_${safeKey}">${safeLabel}</label><textarea id="complete_${safeKey}" name="${safeKey}">${safeValue}</textarea>${hint}`;
    }
    return `<label for="complete_${safeKey}">${safeLabel}</label><input id="complete_${safeKey}" name="${safeKey}" type="${escapeHtml(field.type)}" value="${safeValue}" />${hint}`;
  }).join("");

  box.style.display = "block";
  box.innerHTML = `
    <h2>Complete your profile</h2>
    <p>Found ${PROFILE_COMPLETION_KEYS.length - missing.length} of ${PROFILE_COMPLETION_KEYS.length} profile fields. Add only the missing information below.</p>
    <form id="completionForm">
      ${controls}
      <button type="submit">Save missing info</button>
    </form>
  `;

  $("completionForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveCompletionForm(session, normalized, missing);
  });
}

function buildCompletionPayload(form, fields) {
  const payload = {};
  for (const field of fields) {
    const raw = String(new FormData(form).get(field.key) || "").trim();
    if (!raw) continue;
    if (field.key === "skills" || field.key === "desired_roles") payload[field.key] = normalizeList(raw);
    else if (field.key === "experience_years") payload[field.key] = Number(raw);
    else payload[field.key] = raw;
  }
  return payload;
}

function extractMissingColumn(error) {
  const text = [error?.message, error?.details, error?.hint, error?.error].filter(Boolean).join(" ");
  return text.match(/'([^']+)'\s+column/i)?.[1]
    || text.match(/column\s+"([^"]+)"/i)?.[1]
    || "";
}

async function restProfiles(path, session, opts = {}) {
  const headers = {
    "Content-Type": "application/json",
    "apikey": ANON_KEY,
    "Authorization": `Bearer ${session.access_token}`,
    ...(opts.headers || {}),
  };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles${path}`, { ...opts, headers });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.message || json.error || `Profile save failed: HTTP ${res.status}`);
    err.payload = json;
    throw err;
  }
  return json;
}

async function saveColumnsWithRetry(session, method, path, payload, extraHeaders = {}) {
  const remaining = { ...payload };
  const skipped = [];
  while (Object.keys(remaining).length) {
    try {
      const data = await restProfiles(path, session, {
        method,
        body: JSON.stringify(remaining),
        headers: { "Prefer": "return=representation", ...extraHeaders },
      });
      return { data, skipped };
    } catch (err) {
      const column = extractMissingColumn(err.payload || err);
      if (!column || !(column in remaining)) throw err;
      delete remaining[column];
      skipped.push(column);
    }
  }
  return { data: [], skipped };
}

async function saveProfilePatch(session, profile, payload) {
  const userId = encodeURIComponent(session.user.id);
  const withIdentity = { user_id: session.user.id, email: session.user.email, ...payload };
  const update = await saveColumnsWithRetry(session, "PATCH", `?user_id=eq.${userId}&select=*`, payload);
  if (Array.isArray(update.data) && update.data.length) return update;

  const insert = await saveColumnsWithRetry(
    session,
    "POST",
    "?on_conflict=user_id&select=*",
    withIdentity,
    { "Prefer": "resolution=merge-duplicates,return=representation" },
  );
  return { data: insert.data, skipped: [...update.skipped, ...insert.skipped] };
}

async function saveCompletionForm(session, profile, missing) {
  const form = $("completionForm");
  const payload = buildCompletionPayload(form, missing);
  if (!Object.keys(payload).length) {
    setStatus("Add at least one missing field", true);
    return;
  }

  setStatus("Saving profile...");
  try {
    const result = await saveProfilePatch(session, profile, payload);
    const savedProfile = Array.isArray(result.data) && result.data[0] ? result.data[0] : {};
    const merged = normalizeProfile({ ...profile, ...payload, ...savedProfile, _skipped_profile_columns: result.skipped }, session);
    await chrome.storage.local.set({ profile: merged });
    renderProfile(session, merged);
    renderCompletionPopup(session, merged);
    const skipped = [...new Set(result.skipped || [])];
    setStatus(skipped.length ? `Saved available fields. Schema missing: ${skipped.join(", ")}` : "Profile updated");
  } catch (e) {
    setStatus(e.message || "Could not save profile", true);
  }
}

function showLogin() {
  $("loginGate").style.display = "block";
  $("profile").style.display = "none";
  $("completionPopup").style.display = "none";
  $("fillBtn").style.display = "none";
  $("retryBtn").style.display = "none";
  $("logoutBtn").style.display = "none";
  $("mismatch").style.display = "none";
  $("missingFields").style.display = "none";
}

function showMissingFields(missing = []) {
  const box = $("missingFields");
  const unique = [...new Set(missing)].filter(Boolean);
  if (!unique.length) {
    box.style.display = "none";
    box.innerHTML = "";
    return;
  }
  const items = unique
    .map((key) => `<li>${escapeHtml(FIELD_LABELS[key] || key)}</li>`)
    .join("");
  box.style.display = "block";
  box.innerHTML = `<strong>Missing from your JobAI profile</strong>These fields were found on this form but could not be filled:<ul>${items}</ul>`;
}

$("loginBtn").addEventListener("click", async () => {
  const email = $("emailInput").value.trim().toLowerCase();
  const password = $("passInput").value;
  if (!email || !password) { setStatus("Enter email and password", true); return; }
  setStatus("Signing in…");
  try {
    const session = await signIn(email, password);
    await loadAndRenderProfile(session);
    setStatus("Signed in ✓");
  } catch (e) { setStatus(e.message || "Login failed", true); }
});

$("googleLoginBtn").addEventListener("click", async () => {
  setStatus("Opening Google login...");
  try {
    const session = await signInWithGoogle();
    await loadAndRenderProfile(session);
    setStatus("Signed in with Google");
  } catch (e) { setStatus(e.message || "Google login failed", true); }
});

if (!chrome?.identity?.getRedirectURL || !chrome?.identity?.launchWebAuthFlow) {
  $("googleLoginBtn").disabled = true;
  $("googleLoginBtn").title = "Reload the extension after granting the identity permission.";
}

$("logoutBtn").addEventListener("click", async () => {
  await chrome.storage.local.remove(["session", "profile"]);
  showLogin(); setStatus("");
});

async function runFill() {
  $("mismatch").style.display = "none";
  showMissingFields([]);
  $("retryBtn").style.display = "none";
  const session = await refreshIfNeeded();
  if (!session) { showLogin(); setStatus("Please sign in", true); return; }
  const { profile } = await chrome.storage.local.get("profile");
  if (!profile) { setStatus("Profile not loaded", true); return; }
  const normalizedProfile = normalizeProfile(profile, session);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  const platform = (() => { try { return new URL(tab.url).hostname; } catch { return ""; } })();

  // Ensure content script is injected (works on any URL)
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: ["content.js"] });
  } catch {}

  // Step 1: detect email on page
  let detected = "";
  try {
    const r = await chrome.tabs.sendMessage(tab.id, { type: "DETECT_EMAIL" });
    detected = (r?.email || "").toLowerCase();
  } catch { setStatus("Cannot access this page (try a regular http/https tab)", true); return; }

  const userEmail = (session.user.email || "").toLowerCase();
  if (detected && detected !== userEmail) {
    // Mismatch: alert + block
    $("mismatch").style.display = "block";
    $("mismatch").textContent = `⚠️ Email mismatch. Page email "${detected}" does not match your account "${userEmail}". Auto-fill blocked.`;
    $("retryBtn").style.display = "block";
    setStatus("Verification failed", true);
    fetch(SECURITY_ALERT_URL, {
      method: "POST",
      headers: { "Content-Type":"application/json", "apikey": ANON_KEY, "Authorization": `Bearer ${session.access_token}` },
      body: JSON.stringify({ attempted_email: detected, page_url: tab.url, platform }),
    }).catch(() => {});
    return;
  }

  // Step 2: fill
  const res = await chrome.tabs.sendMessage(tab.id, { type: "FILL_FORM", profile: normalizedProfile });
  showMissingFields(res?.missing || []);
  setStatus(res?.count ? `Filled ${res.count} field(s) ✓` : (res?.missing?.length ? "Some profile fields are missing" : "No matching fields found"), Boolean(!res?.count && res?.missing?.length));
  // analytics
  fetch(TRACK_USAGE_URL, {
    method:"POST", headers:{ "Content-Type":"application/json","apikey":ANON_KEY },
    body: JSON.stringify({ email: userEmail, fields: res?.fields||[], page_url: res?.url||tab.url||"" }),
  }).catch(()=>{});
  // arm submit tracker
  chrome.tabs.sendMessage(tab.id, { type: "ARM_SUBMIT_TRACKER" }).catch(()=>{});
}

$("fillBtn").addEventListener("click", runFill);
$("retryBtn").addEventListener("click", runFill);

// Listen for application submitted from content script
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "APPLICATION_SUBMITTED") {
    refreshIfNeeded().then((session) => {
      if (!session) return;
      const payload = { ...msg.payload, status: "applied" };
      fetch(TRACK_APPLIED_URL, {
        method:"POST",
        headers:{ "Content-Type":"application/json","apikey":ANON_KEY,"Authorization":`Bearer ${session.access_token}` },
        body: JSON.stringify(payload),
      }).catch(()=>{});
    });
  }
});

(async () => {
  const session = await refreshIfNeeded();
  if (session) {
    try {
      let { profile } = await chrome.storage.local.get("profile");
      if (!profile) {
        profile = await fetchProfile(session);
        await chrome.storage.local.set({ profile });
      } else {
        profile = normalizeProfile(profile, session);
      }
      renderProfile(session, profile);
      renderCompletionPopup(session, profile);
    } catch (e) {
      setStatus(e.message || "Profile load failed", true);
      showLogin();
    }
  } else {
    showLogin();
  }
})();
