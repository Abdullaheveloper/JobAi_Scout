// background.js - authenticated boundary for extension data.
// Content scripts never fetch a raw profile directly. They request only the
// current signed-in user's normalized application profile from this worker.
import { api } from "./api.js";
import { profileService } from "./profile-service.js";

chrome.runtime.onInstalled.addListener(() => {
  console.log("JobAI Scout Background Service Worker Installed.");
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!["GET_APPLICATION_PROFILE", "GET_PROFILE_FILE", "TRACK_FORM_FILL"].includes(message?.type)) {
    return undefined;
  }

  (async () => {
    const session = await api.refreshIfNeeded();
    if (!session) throw new Error("Sign in to JobAI Scout in the extension first.");
    if (message.type === "GET_PROFILE_FILE") {
      const result = await api.downloadResume(session, message.filePath);
      sendResponse({ ok: true, blob: result.blob, contentType: result.contentType });
      return;
    }
    if (message.type === "TRACK_FORM_FILL") {
      await api.trackFormFill(session, {
        fields: message.fields,
        page_url: message.page_url,
      });
      sendResponse({ ok: true });
      return;
    }
    const profile = await profileService.loadProfile(session, true);
    sendResponse({ ok: true, profile });
  })().catch((error) => {
    sendResponse({ ok: false, error: error?.message || "Could not load your JobAI profile." });
  });
  return true;
});
