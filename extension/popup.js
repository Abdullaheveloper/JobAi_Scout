// popup.js - JobAI Auto-Fill Extension Controller
import { storage } from "./storage.js";
import { api } from "./api.js";
import { profileService } from "./profile-service.js";

const $ = (id) => document.getElementById(id);
let currentProfile = null;
let profileImageObjectUrl = null;
const setStatus = (message, isError = false) => {
  const status = $("status");
  status.textContent = message || "";
  status.className = "status" + (isError ? " err" : "");
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function hasValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "number") return Number.isFinite(value) && value >= 0;
  if (typeof value === "boolean") return true;
  if (typeof value === "object") return Object.values(value).some(hasValue);
  return false;
}

function careerCollection(profile, key) {
  const items = profile?.career_profile?.[key];
  return Array.isArray(items) ? items : [];
}

// Readiness reflects details that commonly appear on job applications.
function calcCompletion(profile) {
  if (!profile) return 0;
  const checks = [
    hasValue(profile.full_name),
    hasValue(profile.email),
    hasValue(profile.phone),
    hasValue(profile.location),
    hasValue(profile.skills),
    hasValue(profile.linkedin_url),
    hasValue(profile.experience_years) || careerCollection(profile, "experiences").length > 0,
    hasValue(profile.education) || careerCollection(profile, "education").length > 0,
    hasValue(profile.resume_url),
    careerCollection(profile, "projects").length > 0 || hasValue(profile.github_url),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function renderProfile(profile) {
  currentProfile = profile;
  $("userEmail").textContent = profile?.email || "—";
  $("userName").textContent = profile?.full_name || "Profile owner";
  $("userPhone").textContent = profile?.phone || "Not added";
  $("userLocation").textContent = profile?.location || "Not added";

  const initials = String(profile?.full_name || profile?.email || "JobAI")
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  $("userInitials").textContent = initials || "JS";

  const skills = Array.isArray(profile?.skills) ? profile.skills : [];
  $("userSkills").innerHTML = skills.length
    ? skills.slice(0, 6).map((skill) => `<span class="skill-tag">${escapeHtml(skill)}</span>`).join("")
    : '<span class="skill-tag">Add skills in Profile Settings</span>';

  const percentage = calcCompletion(profile);
  $("completionBadge").textContent = percentage + "%";
  $("completionBar").style.width = percentage + "%";
  $("completionBar").parentElement.setAttribute("aria-valuenow", String(percentage));
  $("passportState").textContent = percentage >= 80
    ? "Ready for high-coverage applications."
    : percentage >= 50
      ? "Good foundation — a few facts will improve coverage."
      : "Add verified facts for stronger coverage.";
  $("passportHint").textContent = percentage >= 80
    ? "Your core contact, career and education facts are ready."
    : "Complete work history, education and links in Profile Settings.";

  const hasResume = hasValue(profile?.resume_url);
  $("resumeBadge").textContent = hasResume ? "Ready" : "Missing";
  $("resumeBadge").className = `badge ${hasResume ? "badge-green" : "badge-yellow"}`;
  $("resumeUploadLabel").textContent = hasResume ? "Replace resume" : "Upload resume";
  $("resumeDownloadBtn").hidden = !hasResume;
  $("resumeHelp").textContent = hasResume
    ? "Stored privately and ready for supported application fields."
    : "PDF or DOCX, maximum 10 MB.";

  const hasProfileImage = hasValue(profile?.avatar_url)
    && hasValue(profile?.user_id)
    && String(profile.avatar_url).startsWith(`${profile.user_id}/`);
  $("profileImageBadge").textContent = hasProfileImage ? "Ready" : "Missing";
  $("profileImageBadge").className = `badge ${hasProfileImage ? "badge-green" : "badge-yellow"}`;
  $("profileImageUploadLabel").textContent = hasProfileImage ? "Replace image" : "Upload image";
  $("profileImageHelp").textContent = hasProfileImage
    ? "Stored privately and ready for supported photo fields."
    : hasValue(profile?.avatar_url)
      ? "Upload the image here once so it can be attached securely."
      : "JPG, PNG, or WEBP, maximum 5 MB.";
  void renderProfileImage(profile);
}

async function renderProfileImage(profile) {
  const avatar = $("userInitials");
  if (profileImageObjectUrl) {
    URL.revokeObjectURL(profileImageObjectUrl);
    profileImageObjectUrl = null;
  }
  if (!profile?.avatar_url || !profile?.user_id || !String(profile.avatar_url).startsWith(`${profile.user_id}/`)) return;
  try {
    const session = await api.refreshIfNeeded();
    if (!session) return;
    const result = await api.downloadProfileFile(session, profile.avatar_url, "profile-assets");
    profileImageObjectUrl = URL.createObjectURL(result.blob);
    const image = document.createElement("img");
    image.src = profileImageObjectUrl;
    image.alt = "";
    avatar.replaceChildren(image);
  } catch {
    // Keep initials when the private preview cannot be loaded.
  }
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function savedFileName(filePath, fallback) {
  const name = decodeURIComponent(String(filePath || "").split("/").pop() || "")
    .replace(/^\d+_/, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_");
  return /\.[a-z0-9]{2,5}$/i.test(name) ? name : fallback;
}

function labelFor(key) {
  return String(key || "Field")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function outcomeKey(item) {
  return typeof item === "string" ? item : item?.label || item?.key || "Field";
}

function renderTags(items, badgeClass) {
  return items
    .map((item) => `<span class="badge ${badgeClass}">${escapeHtml(labelFor(outcomeKey(item)))}</span>`)
    .join("");
}

function renderFillResult(result = {}) {
  const filled = Array.isArray(result.fields) ? result.fields : [];
  const missing = Array.isArray(result.missing) ? result.missing : [];
  const suggestions = Array.isArray(result.suggestions) ? result.suggestions : [];
  const reviewed = Array.isArray(result.reviewed) ? result.reviewed : [];
  const protectedFields = Array.isArray(result.protected) ? result.protected : [];
  const reviewItems = [...reviewed, ...suggestions, ...missing];
  const filledCount = Number(result.count || filled.length || 0);

  $("fillResult").style.display = "block";
  $("fillResultTitle").textContent = filledCount > 0 ? "Application prepared" : "Review needed";
  const requiresReview = reviewItems.length > 0 || protectedFields.length > 0;
  $("resultBadge").textContent = requiresReview ? "Review" : "Ready";
  $("resultBadge").className = `badge ${requiresReview ? "badge-yellow" : "badge-green"}`;

  let details = `<div class="result-stats">
    <div class="result-stat filled"><strong>${filledCount}</strong><span>Filled</span></div>
    <div class="result-stat review"><strong>${reviewItems.length}</strong><span>Review</span></div>
    <div class="result-stat protected"><strong>${protectedFields.length}</strong><span>Protected</span></div>
  </div>`;

  if (filled.length) {
    details += `<div class="outcome-group"><p class="outcome-title">Filled from verified facts</p><div class="outcome-tags">${renderTags(filled, "badge-green")}</div></div>`;
  }
  if (reviewItems.length) {
    details += `<div class="outcome-group"><p class="outcome-title">Needs your review</p><div class="outcome-tags">${renderTags(reviewItems, "badge-yellow")}</div></div>`;
  }
  if (protectedFields.length) {
    details += `<div class="outcome-group"><p class="outcome-title">Kept under your control</p><div class="outcome-tags">${renderTags(protectedFields, "badge-purple")}</div></div>`;
  }
  if (!filled.length && !reviewItems.length && !protectedFields.length) {
    details += '<p class="outcome-note">No supported application fields were detected on this page.</p>';
  } else {
    details += '<p class="outcome-note">Check the review panel on the page, then confirm every answer before submitting.</p>';
  }
  $("fillResultDetails").innerHTML = details;
}

function showMain(profile) {
  $("loginGate").style.display = "none";
  $("mainPanel").style.display = "block";
  renderProfile(profile);
}

function showLogin() {
  $("loginGate").style.display = "block";
  $("mainPanel").style.display = "none";
}

$("loginBtn").addEventListener("click", async () => {
  const email = $("emailInput").value.trim().toLowerCase();
  const password = $("passInput").value;
  if (!email || !password) {
    setStatus("Enter your email and password.", true);
    return;
  }

  setStatus("Signing in…");
  $("loginBtn").disabled = true;
  try {
    const session = await api.signIn(email, password);
    let profile;
    try {
      profile = await profileService.loadProfile(session, true);
    } catch {
      profile = profileService.normalizeProfile({}, session);
    }
    showMain(profile);
    setStatus("Signed in securely.");
  } catch (error) {
    const message = error.message || "Login failed";
    if (message.includes("Invalid login")) setStatus("Invalid email or password.", true);
    else if (message.includes("Email not confirmed")) setStatus("Please confirm your email first.", true);
    else if (message.includes("Network error")) setStatus("Cannot reach JobAI. Check your connection.", true);
    else setStatus(message, true);
  } finally {
    $("loginBtn").disabled = false;
  }
});

[$("emailInput"), $("passInput")].forEach((input) => input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !$("loginBtn").disabled) $("loginBtn").click();
}));

$("googleLoginBtn").addEventListener("click", async () => {
  setStatus("Opening Google sign in…");
  $("googleLoginBtn").disabled = true;
  try {
    const session = await api.signInWithGoogle();
    let profile;
    try {
      profile = await profileService.loadProfile(session, true);
    } catch {
      profile = profileService.normalizeProfile({}, session);
    }
    showMain(profile);
    setStatus("Signed in with Google.");
  } catch (error) {
    setStatus(error.message || "Google sign in failed.", true);
  } finally {
    $("googleLoginBtn").disabled = false;
  }
});

$("logoutBtn").addEventListener("click", async () => {
  await storage.removeSession();
  showLogin();
  setStatus("");
});

$("refreshBtn").addEventListener("click", async () => {
  const session = await api.refreshIfNeeded();
  if (!session) {
    setStatus("Your session expired. Sign in again.", true);
    showLogin();
    return;
  }

  setStatus("Refreshing Career Passport…");
  $("refreshBtn").disabled = true;
  try {
    const profile = await profileService.loadProfile(session, true);
    renderProfile(profile);
    setStatus("Career Passport is up to date.");
  } catch (error) {
    setStatus(error.message || "Could not refresh your profile.", true);
  } finally {
    $("refreshBtn").disabled = false;
  }
});

$("resumeUploadBtn").addEventListener("click", () => {
  $("resumeInput").click();
});

$("resumeDownloadBtn").addEventListener("click", async () => {
  const session = await api.refreshIfNeeded();
  if (!session || !currentProfile?.resume_url) {
    setStatus("Upload a resume first.", true);
    return;
  }
  const button = $("resumeDownloadBtn");
  button.disabled = true;
  setStatus("Preparing your saved resume…");
  try {
    const result = await api.downloadResume(session, currentProfile.resume_url);
    downloadBlob(result.blob, savedFileName(currentProfile.resume_url, "JobAI_resume.pdf"));
    setStatus("Resume downloaded. Choose it in Google's file picker.");
  } catch (error) {
    setStatus(error.message || "Could not prepare the resume.", true);
  } finally {
    button.disabled = false;
  }
});

$("resumeInput").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  const extension = String(file.name || "").toLowerCase().match(/\.(pdf|docx)$/)?.[1];
  if (!extension) {
    setStatus("Choose a PDF or DOCX resume.", true);
    $("resumeHelp").textContent = "This file type is not supported. Choose PDF or DOCX.";
    event.target.value = "";
    return;
  }
  if (file.size <= 0 || file.size > 10 * 1024 * 1024) {
    setStatus("Resume must be smaller than 10 MB.", true);
    $("resumeHelp").textContent = "Choose a resume between 1 byte and 10 MB.";
    event.target.value = "";
    return;
  }

  const session = await api.refreshIfNeeded();
  if (!session) {
    setStatus("Your session expired. Sign in again.", true);
    showLogin();
    event.target.value = "";
    return;
  }

  const uploadButton = $("resumeUploadBtn");
  uploadButton.disabled = true;
  $("resumeUploadLabel").textContent = "Uploading…";
  $("resumeHelp").textContent = `Uploading ${file.name}…`;
  setStatus("Saving your resume securely…");

  try {
    await api.uploadResume(session, file);
    await storage.removeProfile();
    const profile = await profileService.loadProfile(session, true);
    renderProfile(profile);
    $("resumeHelp").textContent = `${file.name} is ready for supported job applications.`;
    setStatus("Resume uploaded and ready to attach.");
  } catch (error) {
    setStatus(error.message || "Could not upload the resume.", true);
    $("resumeHelp").textContent = "Upload failed. Your previous resume, if any, was not changed.";
    $("resumeUploadLabel").textContent = "Try upload again";
  } finally {
    uploadButton.disabled = false;
    event.target.value = "";
  }
});

$("profileImageUploadBtn").addEventListener("click", () => {
  $("profileImageInput").click();
});

$("profileImageInput").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const extension = String(file.name || "").toLowerCase().match(/\.(jpe?g|png|webp)$/)?.[1];
  if (!extension) {
    setStatus("Choose a JPG, PNG, or WEBP image.", true);
    $("profileImageHelp").textContent = "This image type is not supported.";
    event.target.value = "";
    return;
  }
  if (file.size <= 0 || file.size > 5 * 1024 * 1024) {
    setStatus("Profile image must be smaller than 5 MB.", true);
    $("profileImageHelp").textContent = "Choose an image between 1 byte and 5 MB.";
    event.target.value = "";
    return;
  }
  const session = await api.refreshIfNeeded();
  if (!session) {
    setStatus("Your session expired. Sign in again.", true);
    showLogin();
    event.target.value = "";
    return;
  }
  const uploadButton = $("profileImageUploadBtn");
  uploadButton.disabled = true;
  $("profileImageUploadLabel").textContent = "Uploading…";
  $("profileImageHelp").textContent = `Uploading ${file.name}…`;
  setStatus("Saving your profile image securely…");
  try {
    await api.uploadProfileImage(session, file);
    await storage.removeProfile();
    const profile = await profileService.loadProfile(session, true);
    renderProfile(profile);
    $("profileImageHelp").textContent = `${file.name} is ready for supported application photo fields.`;
    setStatus("Profile image uploaded and ready to attach.");
  } catch (error) {
    setStatus(error.message || "Could not upload the profile image.", true);
    $("profileImageHelp").textContent = "Upload failed. Your previous image, if any, was not changed.";
    $("profileImageUploadLabel").textContent = "Try upload again";
  } finally {
    uploadButton.disabled = false;
    event.target.value = "";
  }
});

$("fillBtn").addEventListener("click", async () => {
  const session = await api.refreshIfNeeded();
  if (!session) {
    setStatus("Your session expired. Sign in again.", true);
    showLogin();
    return;
  }

  const fillButton = $("fillBtn");
  fillButton.disabled = true;
  fillButton.innerHTML = '<span class="spinner" aria-hidden="true"></span><span>Preparing application…</span>';
  setStatus("Matching verified facts to this form…");

  try {
    const profile = await profileService.loadProfile(session);
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("No active browser tab was found.");

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["decision-engine.js", "content.js"],
      });
    } catch {
      // The script may already be active on this page.
    }

    const result = await chrome.tabs.sendMessage(tab.id, { type: "FILL_FORM", profile });
    renderFillResult(result);

    const reviewCount = (result.missing?.length || 0) + (result.suggestions?.length || 0) + (result.reviewed?.length || 0);
    setStatus(result.count > 0
      ? `Filled ${result.count} field${result.count === 1 ? "" : "s"}${reviewCount ? ` · ${reviewCount} to review` : ""}.`
      : "No supported fields were filled on this page.");
  } catch (error) {
    setStatus(error.message || "Could not fill this form.", true);
  } finally {
    fillButton.disabled = false;
    fillButton.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m13 2-9 12h7l-1 8 9-12h-7l1-8Z"/></svg><span>Fill this application</span>';
  }
});

(async () => {
  const session = await api.refreshIfNeeded();
  if (!session) {
    showLogin();
    return;
  }

  try {
    let profile;
    try {
      profile = await profileService.loadProfile(session);
    } catch {
      profile = await storage.getProfile() || profileService.normalizeProfile({}, session);
    }
    showMain(profile);
  } catch {
    showLogin();
  }
})();
