// profile-service.js - Service for loading, caching, and validating user profile
import { api } from "./api.js";
import { storage } from "./storage.js";

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

export const profileService = {
  // Normalize profile and assign email/user_id if missing
  normalizeProfile(profile, session) {
    const next = { ...(profile || {}) };
    if (!next.user_id && session?.user?.id) next.user_id = session.user.id;
    if (!next.email && session?.user?.email) next.email = session.user.email;
    
    // Ensure lists are normalized arrays
    if (typeof next.skills === "string") {
      next.skills = next.skills.split(",").map(s => s.trim()).filter(Boolean);
    }
    if (typeof next.desired_roles === "string") {
      next.desired_roles = next.desired_roles.split(",").map(r => r.trim()).filter(Boolean);
    }
    
    return next;
  },

  async loadProfile(session, forceRefresh = false) {
    if (!forceRefresh) {
      const cached = await storage.getProfile();
      if (cached) return cached;
    }
    const profile = await api.getProfile(session);
    const normalized = this.normalizeProfile(profile, session);
    await storage.setProfile(normalized);
    return normalized;
  },

  async getProfileData() {
    return await storage.getProfile();
  },

  async updateProfile(session, payload) {
    const res = await api.saveProfilePatch(session, payload);
    const updatedProfile = Array.isArray(res) && res[0] ? res[0] : res;
    
    // Merge cached profile
    const cached = await storage.getProfile();
    const merged = this.normalizeProfile({ ...cached, ...payload, ...updatedProfile }, session);
    await storage.setProfile(merged);
    return merged;
  },

  hasProfileValue(profile, key) {
    const value = profile?.[key];
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "number") return Number.isFinite(value);
    return String(value ?? "").trim().length > 0;
  },

  missingProfileFields(profile) {
    return PROFILE_COMPLETION_FIELDS.filter((field) => !this.hasProfileValue(profile, field.key));
  },

  getProfileCompletionDetails(profile) {
    const missing = this.missingProfileFields(profile);
    const total = PROFILE_COMPLETION_FIELDS.length;
    const filled = total - missing.length;
    const pct = Math.round((filled / total) * 100);
    return { missing, filled, total, pct };
  }
};
