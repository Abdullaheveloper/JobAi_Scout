// storage.js - Chrome Extension Local Storage Wrapper

export const storage = {
  async getSession() {
    const res = await chrome.storage.local.get("session");
    return res.session || null;
  },

  async setSession(session) {
    await chrome.storage.local.set({ session });
  },

  async removeSession() {
    await chrome.storage.local.remove(["session", "profile"]);
  },

  async getProfile() {
    const res = await chrome.storage.local.get("profile");
    return res.profile || null;
  },

  async setProfile(profile) {
    await chrome.storage.local.set({ profile });
  },

  async removeProfile() {
    await chrome.storage.local.remove("profile");
  },

  async getUseProfile() {
    const res = await chrome.storage.local.get("useProfile");
    // Default to true if not explicitly set
    return res.useProfile !== false;
  },

  async setUseProfile(useProfile) {
    await chrome.storage.local.set({ useProfile });
  }
};
