// profile-service.js - Service for loading, caching, and validating user profile
import { api } from "./api.js";
import { storage } from "./storage.js";

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
  }
};
