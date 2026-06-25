// popup.js - Main extension controller, binding UI events to services
import { storage } from "./storage.js";
import { api } from "./api.js";
import { profileService } from "./profile-service.js";
import { jobSyncService } from "./job-sync-service.js";

const $ = (id) => document.getElementById(id);
const setStatus = (msg, err = false) => {
  const s = $("status");
  s.textContent = msg || "";
  s.className = "status" + (err ? " err" : "");
};

const PORTAL_PATTERNS = {
  linkedin: /linkedin\.com/i, indeed: /indeed\.com/i, glassdoor: /glassdoor\./i,
  monster: /monster\.com/i, bayt: /bayt\.com/i, rozee: /rozee\.pk/i,
  wellfound: /wellfound\.com/i, dice: /dice\.com/i, careerbuilder: /careerbuilder\./i,
  greenhouse: /greenhouse\.io/i, lever: /lever\.co/i
};

function detectPortal(url) {
  if (!url) return null;
  for (const [name, pattern] of Object.entries(PORTAL_PATTERNS)) {
    if (pattern.test(url)) return name;
  }
  return null;
}

function getPortalClass(portal) {
  const map = {
    linkedin: "portal-linkedin", indeed: "portal-indeed", glassdoor: "portal-glassdoor",
    monster: "portal-monster", bayt: "portal-bayt", rozee: "portal-rozee",
    wellfound: "portal-wellfound", dice: "portal-dice", careerbuilder: "portal-careerbuilder",
    greenhouse: "portal-greenhouse", lever: "portal-lever"
  };
  return map[portal] || "portal-default";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function timeAgo(dateStr) {
  if (!dateStr) return "Unknown";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function isNewJob(dateStr) {
  if (!dateStr) return false;
  return Date.now() - new Date(dateStr).getTime() < 24 * 60 * 60 * 1000;
}

// Helper to build auth headers using the exported ANON_KEY
function authHeaders(session) {
  return {
    "Authorization": `Bearer ${session.access_token}`,
    "apikey": api.ANON_KEY,
    "Content-Type": "application/json"
  };
}

// ── Tab Management ──
function switchTab(tabName) {
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === tabName));
  document.querySelectorAll(".panel").forEach(p => p.classList.toggle("active", p.id === `panel-${tabName}`));
  if (tabName === "jobs") loadRecommendedJobs();
  if (tabName === "saved") loadSavedJobs();
  if (tabName === "dashboard") loadDashboardStats();
  if (tabName === "scan") renderScanTabDetails();
}

document.querySelectorAll(".tab").forEach(t => {
  t.addEventListener("click", () => switchTab(t.dataset.tab));
});

// ── Profile Details in Scan Tab ──
async function renderScanTabDetails() {
  const useProfile = await storage.getUseProfile();
  $("useProfileCheck").checked = useProfile;
  
  const profile = await storage.getProfile();
  if (profile && useProfile) {
    $("profileSummaryCard").style.display = "block";
    $("summaryRole").textContent = profile.desired_role || "-";
    $("summarySkills").textContent = Array.isArray(profile.skills) ? profile.skills.join(", ") : (profile.skills || "-");
    $("summaryLocation").textContent = profile.location || "-";
    $("summaryExperience").textContent = profile.experience || "-";
    $("summaryJobType").textContent = profile.job_type || "-";
  } else {
    $("profileSummaryCard").style.display = "none";
  }
  detectCurrentPortal();
}

$("useProfileCheck").addEventListener("change", async (e) => {
  const checked = e.target.checked;
  await storage.setUseProfile(checked);
  renderScanTabDetails();
});

// ── Dashboard stats & loading ──
async function loadDashboardStats() {
  const session = await api.refreshIfNeeded();
  if (!session) return;
  try {
    const headers = authHeaders(session);

    // Fetch scan history
    let scansArray = [];
    try {
      const r = await fetch(`${api.SUPABASE_URL}/rest/v1/scan_history?user_id=eq.${session.user.id}&select=*&order=scanned_at.desc&limit=20`, { headers });
      if (r.ok) {
        scansArray = await r.json().catch(() => []);
        if (!Array.isArray(scansArray)) scansArray = [];
      }
    } catch (e) {
      console.warn("[popup] Scan history fetch failed:", e.message);
    }

    const totalScanned = scansArray.reduce((s, r) => s + (r.jobs_found || 0), 0);
    const totalMatched = scansArray.reduce((s, r) => s + (r.jobs_matched || 0), 0);
    const totalSynced = scansArray.reduce((s, r) => s + (r.jobs_synced || 0), 0);

    $("statScanned").textContent = totalScanned;
    $("statMatched").textContent = totalMatched;
    $("statSynced").textContent = totalSynced;
    $("lastScan").textContent = scansArray.length ? timeAgo(scansArray[0].scanned_at) : "Never";

    // Recommended jobs average matching score
    const recJobs = await api.getRecommendedJobs(session);
    const avgScore = recJobs.length ? Math.round(recJobs.reduce((s, r) => s + (r.match_score || 0), 0) / recJobs.length) : 0;
    $("avgMatch").textContent = avgScore ? `${avgScore}%` : "-";

    // Saved count
    let savedCount = 0;
    try {
      const r = await fetch(`${api.SUPABASE_URL}/rest/v1/saved_jobs?user_id=eq.${session.user.id}&recommended_job_id=not.is.null&select=id`, { headers });
      if (r.ok) {
        const saved = await r.json().catch(() => []);
        savedCount = Array.isArray(saved) ? saved.length : 0;
      }
    } catch (e) {
      console.warn("[popup] Saved jobs count fetch failed:", e.message);
    }
    
    $("statSaved").textContent = savedCount;
  } catch (e) {
    console.warn("Dashboard stats error:", e);
  }
}

function renderProfile(session, profile) {
  $("loginGate").style.display = "none";
  $("tabsBar").style.display = "flex";
  const skillsValue = Array.isArray(profile.skills) ? profile.skills.join(", ") : (profile.skills || "");
  $("profileArea").innerHTML = `
    <div class="card" style="margin-bottom:10px">
      <div class="row"><span>Signed in</span><span>${escapeHtml(session.user.email)}</span></div>
      <div class="row"><span>Name</span><span>${escapeHtml(profile.full_name || "-")}</span></div>
      <div class="row"><span>Skills</span><span title="${escapeHtml(skillsValue)}">${escapeHtml(skillsValue || "-")}</span></div>
    </div>
  `;
}

// ── Recommended Jobs Tab ──
async function loadRecommendedJobs() {
  const session = await api.refreshIfNeeded();
  if (!session) return;
  try {
    const jobs = await api.getRecommendedJobs(session);
    
    // Fetch saved jobs
    let savedIds = new Set();
    try {
      const headers = authHeaders(session);
      const r = await fetch(`${api.SUPABASE_URL}/rest/v1/saved_jobs?user_id=eq.${session.user.id}&recommended_job_id=not.is.null&select=recommended_job_id`, { headers });
      if (r.ok) {
        const savedRecs = await r.json().catch(() => []);
        savedIds = new Set(savedRecs.map(s => s.recommended_job_id));
      }
    } catch (e) {
      console.warn("[popup] Saved jobs fetch failed:", e.message);
    }

    $("jobsCount").textContent = `${jobs.length} jobs`;

    if (!jobs.length) {
      $("jobsList").innerHTML = '<div class="empty"><div class="icon">&#128188;</div><p>No recommended jobs yet.<br>Scan a job portal to get started!</p></div>';
      return;
    }
    
    $("jobsList").innerHTML = jobs.map(job => renderJobCard({
      id: job.id,
      title: job.title,
      company: job.company,
      location: job.location,
      source_portal: job.source || job.source_portal || "unknown",
      source_url: job.job_url || job.source_url,
      match_score: job.match_score,
      synced_at: job.synced_at || new Date().toISOString()
    }, savedIds.has(job.id))).join("");

    attachJobCardListeners(session, savedIds);
  } catch (e) {
    console.warn("Load jobs error:", e);
    $("jobsList").innerHTML = `<div class="alert">${escapeHtml(e.message)}</div>`;
  }
}

function renderJobCard(job, isSaved) {
  const score = job.match_score || 0;
  const matchClass = score >= 70 ? "match-high" : score >= 50 ? "match-mid" : "match-low";
  const portalClass = getPortalClass(job.source_portal);
  const isNew = isNewJob(job.synced_at);

  return `
    <div class="job-card" data-job-id="${job.id}">
      <div style="display:flex;gap:10px;align-items:start">
        <div class="match-ring ${matchClass}">${score}%</div>
        <div style="flex:1;min-width:0">
          <div class="job-title">
            ${job.source_url ? `<a href="${escapeHtml(job.source_url)}" target="_blank" style="color:inherit;text-decoration:none">${escapeHtml(job.title)}</a>` : escapeHtml(job.title)}
            ${isNew ? '<span class="badge badge-new">NEW</span>' : ""}
          </div>
          <div class="job-company">${escapeHtml(job.company)} ${job.location ? `· ${escapeHtml(job.location)}` : ""}</div>
          <div class="job-meta">
            <span class="portal-badge ${portalClass}">${escapeHtml(job.source_portal)}</span>
          </div>
        </div>
      </div>
      <div class="job-actions">
        <button class="save-job-btn ${isSaved ? "secondary" : ""}" data-job-id="${job.id}" data-saved="${isSaved}">${isSaved ? "&#128278; Saved" : "&#128278; Save"}</button>
        ${job.source_url ? `<button class="secondary" onclick="window.open('${escapeHtml(job.source_url)}','_blank')">&#128279; View</button>` : ""}
      </div>
    </div>
  `;
}

function attachJobCardListeners(session, savedIds) {
  document.querySelectorAll(".save-job-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const jobId = btn.dataset.jobId;
      const wasSaved = btn.dataset.saved === "true";
      try {
        const headers = authHeaders(session);
        if (wasSaved) {
          await fetch(`${api.SUPABASE_URL}/rest/v1/saved_jobs?user_id=eq.${session.user.id}&recommended_job_id=eq.${jobId}`, {
            method: "DELETE",
            headers
          });
          savedIds.delete(jobId);
          btn.dataset.saved = "false";
          btn.className = "save-job-btn";
          btn.innerHTML = "&#128278; Save";
          setStatus("Job unsaved");
        } else {
          await fetch(`${api.SUPABASE_URL}/rest/v1/saved_jobs`, {
            method: "POST",
            headers,
            body: JSON.stringify({ user_id: session.user.id, recommended_job_id: jobId })
          });
          savedIds.add(jobId);
          btn.dataset.saved = "true";
          btn.className = "save-job-btn secondary";
          btn.innerHTML = "&#128278; Saved";
          setStatus("Job saved!");
        }
      } catch (e) {
        setStatus(e.message, true);
      }
    });
  });
}

// ── Saved Jobs Tab ──
async function loadSavedJobs() {
  const session = await api.refreshIfNeeded();
  if (!session) return;
  try {
    const headers = authHeaders(session);
    
    // Fetch saved jobs
    const savedRes = await fetch(`${api.SUPABASE_URL}/rest/v1/saved_jobs?user_id=eq.${session.user.id}&recommended_job_id=not.is.null&select=id,recommended_job_id,saved_at`, { headers });
    const saved = await savedRes.json().catch(() => []);

    if (!saved.length) {
      $("savedCount").textContent = "0 saved";
      $("savedList").innerHTML = '<div class="empty"><div class="icon">&#128278;</div><p>No saved jobs yet.<br>Save jobs from the Jobs tab.</p></div>';
      return;
    }

    // Fetch matching recommended jobs
    const recIds = saved.map(s => s.recommended_job_id).filter(Boolean);
    const recJobs = await api.getRecommendedJobs(session);
    const jobsMap = {};
    recJobs.forEach(j => { jobsMap[j.id] = j; });

    $("savedCount").textContent = `${saved.length} saved`;
    $("savedList").innerHTML = saved.map(s => {
      const job = jobsMap[s.recommended_job_id];
      if (!job) return "";
      return renderJobCard({
        id: job.id,
        title: job.title,
        company: job.company,
        location: job.location,
        source_portal: job.source || job.source_portal || "unknown",
        source_url: job.job_url || job.source_url,
        match_score: job.match_score,
        synced_at: job.synced_at || new Date().toISOString()
      }, true);
    }).filter(Boolean).join("");
    
    attachJobCardListeners(session, new Set(recIds));
  } catch (e) {
    console.warn("Load saved jobs error:", e);
    $("savedList").innerHTML = `<div class="alert">${escapeHtml(e.message)}</div>`;
  }
}

// ── Run Job Sync ──
async function runScan() {
  const session = await api.refreshIfNeeded();
  if (!session) {
    showLogin();
    setStatus("Please sign in", true);
    return;
  }

  let tab;
  try {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  } catch (e) {
    setStatus("Could not access current tab", true);
    return;
  }

  if (!tab?.id || !tab.url) {
    setStatus("No active tab", true);
    return;
  }

  const portal = detectPortal(tab.url);
  if (!portal) {
    setStatus("Please visit a supported job portal (LinkedIn, Indeed, Glassdoor, Greenhouse, Lever, etc.)", true);
    return;
  }

  const scanBtn = $("scanBtn");
  const scanIcon = $("scanIcon");
  const scanLabel = $("scanLabel");
  const progressArea = $("syncProgressArea");
  const progressBar = $("syncProgressBar");
  const progressState = $("progressState");
  const syncSuccessMessage = $("syncSuccessMessage");

  // Reset progress UI
  progressArea.style.display = "block";
  syncSuccessMessage.style.display = "none";
  progressBar.style.width = "0%";
  $("syncScanned").textContent = "0";
  $("syncMatched").textContent = "0";
  $("syncUploaded").textContent = "0";

  scanBtn.disabled = true;
  scanIcon.classList.add("scanning");
  scanLabel.textContent = "Scanning...";
  setStatus("Scanning jobs on " + portal + "...");

  // Inject content.js if needed
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
  } catch (injectErr) {
    console.warn("[popup] Content script injection:", injectErr.message);
  }

  try {
    // Wait a moment for the content script to initialize
    await new Promise(r => setTimeout(r, 300));
    
    const result = await chrome.tabs.sendMessage(tab.id, { type: "SCAN_JOBS", portal });
    if (!result?.jobs?.length) {
      progressArea.style.display = "none";
      setStatus("No jobs found on this page. Try scrolling down or visiting a job listings page.", true);
      return;
    }

    $("syncScanned").textContent = result.jobs.length;
    const useProfile = $("useProfileCheck").checked;

    // Run sync coordinator service
    const syncData = await jobSyncService.syncJobs(
      session,
      result.jobs,
      portal,
      useProfile,
      (message, progress) => {
        progressBar.style.width = progress + "%";
        progressState.textContent = message;
        setStatus(message);
      }
    );

    $("syncMatched").textContent = syncData.jobs_matched;
    $("syncUploaded").textContent = syncData.jobs_synced;
    
    // Show success details
    syncSuccessMessage.style.display = "block";
    setStatus(`Done! ${syncData.jobs_synced} jobs synced to JobAI`);
    
    // Auto-update dashboard metrics
    loadDashboardStats();
  } catch (e) {
    console.error("Scan error:", e);
    setStatus(e.message || "Scan failed", true);
  } finally {
    scanBtn.disabled = false;
    scanIcon.classList.remove("scanning");
    scanLabel.textContent = "Scrape Jobs";
  }
}

$("scanBtn").addEventListener("click", runScan);

// Dashboard Scrape Job Button triggers Scan Tab and Scan function
$("dashboardScrapeBtn").addEventListener("click", () => {
  switchTab("scan");
  runScan();
});

$("refreshProfileBtn").addEventListener("click", async () => {
  const session = await api.refreshIfNeeded();
  if (!session) return;
  setStatus("Refreshing profile...");
  try {
    await profileService.loadProfile(session, true);
    loadDashboardStats();
    renderProfile(session, await storage.getProfile());
    setStatus("Profile refreshed");
  } catch (e) {
    setStatus(e.message, true);
  }
});

// ── Portal Detection ──
async function detectCurrentPortal() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const portal = detectPortal(tab?.url);
    $("portalDetected").textContent = portal
      ? `Portal detected: ${portal.charAt(0).toUpperCase() + portal.slice(1)} — Ready to scan!`
      : "Visit a supported portal: LinkedIn, Indeed, Glassdoor, Monster, Bayt, Rozee, Wellfound, Dice, CareerBuilder, Greenhouse, Lever";
  } catch {
    $("portalDetected").textContent = "Visit a supported portal to start scanning";
  }
}

// ── Login / Logout ──
function showLogin() {
  $("loginGate").style.display = "block";
  $("tabsBar").style.display = "none";
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  $("panel-dashboard").classList.add("active");
}

$("loginBtn").addEventListener("click", async () => {
  const email = $("emailInput").value.trim().toLowerCase();
  const password = $("passInput").value;
  if (!email || !password) {
    setStatus("Enter email and password", true);
    return;
  }
  setStatus("Signing in…");
  $("loginBtn").disabled = true;
  try {
    const session = await api.signIn(email, password);
    let profile;
    try {
      profile = await profileService.loadProfile(session, true);
    } catch (profileErr) {
      console.warn("[popup] Failed to load profile on sign in, using default:", profileErr);
      profile = profileService.normalizeProfile({}, session);
    }
    renderProfile(session, profile);
    loadDashboardStats();
    renderScanTabDetails();
    setStatus("Signed in successfully!");
  } catch (e) {
    const msg = e.message || "Login failed";
    // Provide user-friendly error messages
    if (msg.includes("Invalid login")) {
      setStatus("Invalid email or password. Please try again.", true);
    } else if (msg.includes("Email not confirmed")) {
      setStatus("Please confirm your email before signing in.", true);
    } else if (msg.includes("Network error")) {
      setStatus("Cannot reach server. Check your internet connection.", true);
    } else {
      setStatus(msg, true);
    }
  } finally {
    $("loginBtn").disabled = false;
  }
});

$("googleLoginBtn").addEventListener("click", async () => {
  setStatus("Opening Google login...");
  try {
    const session = await api.signInWithGoogle();
    let profile;
    try {
      profile = await profileService.loadProfile(session, true);
    } catch (profileErr) {
      console.warn("[popup] Failed to load profile on Google sign in, using default:", profileErr);
      profile = profileService.normalizeProfile({}, session);
    }
    renderProfile(session, profile);
    loadDashboardStats();
    renderScanTabDetails();
    setStatus("Signed in with Google");
  } catch (e) {
    setStatus(e.message || "Google login failed", true);
  }
});

$("logoutBtn").addEventListener("click", async () => {
  await storage.removeSession();
  showLogin();
  setStatus("");
});

// Listen for application submitted from content script
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "APPLICATION_SUBMITTED") {
    api.refreshIfNeeded().then((session) => {
      if (!session) return;
      api.trackApplied(session, msg.payload);
    });
  }
});

// ── Init ──
(async () => {
  const session = await api.refreshIfNeeded();
  if (session) {
    try {
      let profile;
      try {
        profile = await profileService.loadProfile(session);
      } catch (profileErr) {
        console.warn("[popup] Init profile load failed, using cached/default:", profileErr);
        profile = await storage.getProfile() || profileService.normalizeProfile({}, session);
      }
      renderProfile(session, profile);
      loadDashboardStats();
      renderScanTabDetails();
    } catch (e) {
      console.warn("[popup] Init dashboard load failed:", e.message);
      setStatus(e.message || "Session load failed", true);
      showLogin();
    }
  } else {
    showLogin();
  }
})();

