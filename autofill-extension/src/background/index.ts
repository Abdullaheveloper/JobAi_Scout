import { getValidSession, loadProfile, logout, signIn } from "../lib/api";
import type { AuthSession, UserProfile } from "../lib/types";

// ── Message Router ──
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "LOGIN") {
    handleLogin(msg.email, msg.password)
      .then((session) => sendResponse({ ok: true, session }))
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true; // async response
  }

  if (msg?.type === "GET_SESSION") {
    getValidSession()
      .then((session) => sendResponse({ ok: true, session }))
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }

  if (msg?.type === "GET_PROFILE") {
    loadProfile(msg.forceRefresh || false)
      .then((profile) => sendResponse({ ok: true, profile }))
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }

  if (msg?.type === "LOGOUT") {
    logout()
      .then(() => sendResponse({ ok: true }))
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }

  if (msg?.type === "FILL_CURRENT_TAB") {
    handleFillCurrentTab()
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }
});

async function handleLogin(email: string, password: string) {
  return signIn(email, password);
}

async function handleFillCurrentTab() {
  const session = await getValidSession();
  if (!session) throw new Error("Not signed in");

  const profile = await loadProfile();
  if (!profile) throw new Error("Could not load profile");

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active tab");

  // Inject content script
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["src/content/index.js"],
  });

  // Wait for injection
  await new Promise((r) => setTimeout(r, 300));

  // Send fill command
  const response = await chrome.tabs.sendMessage(tab.id, {
    type: "FILL_FORM",
    profile,
  });

  return response;
}

// ── On Install ──
chrome.runtime.onInstalled.addListener(() => {
  console.log("[AutoFill Pro] Extension installed");
});
