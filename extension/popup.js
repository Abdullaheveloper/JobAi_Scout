// popup.js - JobAI Auto-Fill Extension Controller
import { storage } from "./storage.js";
import { api } from "./api.js";
import { profileService } from "./profile-service.js";

const $ = (id) => document.getElementById(id);
const setStatus = (msg, err = false) => {
  const s = $("status");
  s.textContent = msg || "";
  s.className = "status" + (err ? " err" : "");
};

function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── Profile Completeness ──
function calcCompletion(profile) {
  if (!profile) return 0;
  const fields = ["full_name", "email", "phone", "location", "linkedin_url", "github_url", "skills", "experience_years", "education"];
  const filled = fields.filter(f => {
    const v = profile[f];
    if (v === null || v === undefined) return false;
    if (typeof v === "string") return v.trim().length > 0;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === "number") return v > 0;
    return false;
  });
  return Math.round((filled.length / fields.length) * 100);
}

// ── Render Profile ──
function renderProfile(profile) {
  $("userEmail").textContent = profile?.email || "-";
  $("userName").textContent = profile?.full_name || "-";
  $("userPhone").textContent = profile?.phone || "-";
  $("userLocation").textContent = profile?.location || "-";

  const skills = Array.isArray(profile?.skills) ? profile.skills : [];
  $("userSkills").innerHTML = skills.length
    ? skills.slice(0, 8).map(s => `<span class="skill-tag">${escapeHtml(s)}</span>`).join("")
    : '<span style="font-size:11px;color:#9ca3af;">No skills set</span>';

  const pct = calcCompletion(profile);
  $("completionBadge").textContent = pct + "%";
  $("completionBadge").className = "badge " + (pct >= 80 ? "badge-green" : pct >= 50 ? "badge-yellow" : "badge-blue");
  $("completionBar").style.width = pct + "%";
}

// ── Show Main Panel ──
function showMain(session, profile) {
  $("loginGate").style.display = "none";
  $("mainPanel").style.display = "block";
  renderProfile(profile);
}

// ── Show Login ──
function showLogin() {
  $("loginGate").style.display = "block";
  $("mainPanel").style.display = "none";
}

// ── Login ──
$("loginBtn").addEventListener("click", async () => {
  const email = $("emailInput").value.trim().toLowerCase();
  const password = $("passInput").value;
  if (!email || !password) { setStatus("Enter email and password", true); return; }
  setStatus("Signing in...");
  $("loginBtn").disabled = true;
  try {
    const session = await api.signIn(email, password);
    let profile;
    try { profile = await profileService.loadProfile(session, true); }
    catch { profile = profileService.normalizeProfile({}, session); }
    showMain(session, profile);
    setStatus("Signed in!");
  } catch (e) {
    const msg = e.message || "Login failed";
    if (msg.includes("Invalid login")) setStatus("Invalid email or password.", true);
    else if (msg.includes("Email not confirmed")) setStatus("Please confirm your email first.", true);
    else if (msg.includes("Network error")) setStatus("Cannot reach server. Check your connection.", true);
    else setStatus(msg, true);
  } finally { $("loginBtn").disabled = false; }
});

$("googleLoginBtn").addEventListener("click", async () => {
  setStatus("Opening Google login...");
  try {
    const session = await api.signInWithGoogle();
    let profile;
    try { profile = await profileService.loadProfile(session, true); }
    catch { profile = profileService.normalizeProfile({}, session); }
    showMain(session, profile);
    setStatus("Signed in with Google!");
  } catch (e) { setStatus(e.message || "Google login failed", true); }
});

// ── Logout ──
$("logoutBtn").addEventListener("click", async () => {
  await storage.removeSession();
  showLogin();
  setStatus("");
});

// ── Refresh Profile ──
$("refreshBtn").addEventListener("click", async () => {
  const session = await api.refreshIfNeeded();
  if (!session) return setStatus("Not signed in", true);
  setStatus("Refreshing profile...");
  try {
    const profile = await profileService.loadProfile(session, true);
    renderProfile(profile);
    setStatus("Profile refreshed!");
  } catch (e) { setStatus(e.message, true); }
});

// ── Auto Fill ──
$("fillBtn").addEventListener("click", async () => {
  const session = await api.refreshIfNeeded();
  if (!session) return setStatus("Not signed in", true);

  const fillBtn = $("fillBtn");
  fillBtn.disabled = true;
  fillBtn.innerHTML = '<span class="spinner" style="display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,0.3);border-top-color:white;border-radius:50%;animation:spin 0.6s linear infinite;"></span> Filling...';
  setStatus("Auto-filling form...");

  try {
    const profile = await profileService.loadProfile(session);

    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("No active tab");

    // Inject content script if needed
    try { await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] }); }
    catch {}

    // Send fill message
    const result = await chrome.tabs.sendMessage(tab.id, { type: "FILL_FORM", profile });

    // Show result
    $("fillResult").style.display = "block";
    $("fillResultTitle").textContent = result.count > 0 ? "Form Filled!" : "No Fields Found";

    let details = "";
    if (result.count > 0) {
      details += `<p style="font-size:13px;margin:0 0 6px;"><strong>${result.count}</strong> field(s) filled</p>`;
      if (result.fields?.length) {
        details += `<div style="display:flex;flex-wrap:wrap;gap:4px;">`;
        details += result.fields.map(f => `<span class="badge badge-green">${escapeHtml(f)}</span>`).join("");
        details += `</div>`;
      }
    }
    if (result.missing?.length) {
      details += `<p style="font-size:12px;color:#92400e;margin:8px 0 4px;">Missing from profile:</p>`;
      details += `<div style="display:flex;flex-wrap:wrap;gap:4px;">`;
      details += result.missing.map(f => `<span class="badge badge-yellow">${escapeHtml(f)}</span>`).join("");
      details += `</div>`;
      details += `<p style="font-size:11px;color:#6b7280;margin-top:6px;">A side panel will appear on the page to fill these manually.</p>`;
    }
    $("fillResultDetails").innerHTML = details;

    setStatus(result.count > 0 ? `Filled ${result.count} field(s)!` : "No fillable fields found on this page.");
  } catch (e) {
    setStatus(e.message || "Fill failed", true);
  } finally {
    fillBtn.disabled = false;
    fillBtn.innerHTML = '<span class="icon">&#9889;</span> Auto Fill This Form';
  }
});

// ── Init ──
(async () => {
  const session = await api.refreshIfNeeded();
  if (session) {
    try {
      let profile;
      try { profile = await profileService.loadProfile(session); }
      catch { profile = await storage.getProfile() || profileService.normalizeProfile({}, session); }
      showMain(session, profile);
    } catch (e) {
      showLogin();
    }
  } else {
    showLogin();
  }
})();
