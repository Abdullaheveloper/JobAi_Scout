/**
 * Form Fill metering contracts:
 * - Profile load (extension-profile / GET_APPLICATION_PROFILE) must NOT consume form_fill quota.
 * - Real user-initiated fill (TRACK_FORM_FILL → track-extension-usage) MUST consume it.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";

const root = new URL("./", import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, root), "utf8");

const api = read("api.js");
const background = read("background.js");
const content = read("content.js");
const popup = read("popup.js");
const popupHtml = read("popup.html");
const extensionProfile = read("../supabase/functions/extension-profile/index.ts");
const trackUsage = read("../supabase/functions/track-extension-usage/index.ts");

// ── Edge: profile load is read-only ─────────────────────────────────────────
assert.doesNotMatch(
  extensionProfile,
  /enforceUsageLimit|feature_usage_log|form_fill|recordUsageLog/,
  "extension-profile must not check or record Form Fill usage",
);
assert.match(
  extensionProfile,
  /Profile load is read-only/,
  "extension-profile should document that metering lives on the fill path",
);

// ── Edge: real fill path meters form_fill ───────────────────────────────────
assert.match(
  trackUsage,
  /enforceUsageLimit\([\s\S]*?["']form_fill["'][\s\S]*?record:\s*true/,
  "track-extension-usage must enforce+record form_fill on each fill",
);
assert.match(
  trackUsage,
  /from\(["']extension_usage["']\)/,
  "track-extension-usage should still log extension_usage analytics",
);

// ── Extension wiring ────────────────────────────────────────────────────────
assert.match(api, /async trackFormFill\(/, "api must expose trackFormFill");
assert.match(api, /track-extension-usage/, "api.trackFormFill must call track-extension-usage");
assert.match(
  api,
  /async getProfile\([\s\S]*?extension-profile/,
  "getProfile must load via extension-profile only",
);
assert.doesNotMatch(
  api.match(/async getProfile\([\s\S]*?\n  \},/)?.[0] || "",
  /trackFormFill|track-extension-usage/,
  "getProfile must not call track-extension-usage",
);

assert.match(background, /TRACK_FORM_FILL/, "background must handle TRACK_FORM_FILL");
assert.match(
  background,
  /message\.type === ["']TRACK_FORM_FILL["'][\s\S]*?api\.trackFormFill/,
  "TRACK_FORM_FILL must call api.trackFormFill",
);
assert.match(
  background,
  /GET_APPLICATION_PROFILE|loadProfile\(session/,
  "background still serves profile loads separately",
);
// Profile branch must not call trackFormFill
const trackBranch = background.match(
  /if \(message\.type === ["']TRACK_FORM_FILL["']\) \{[\s\S]*?return;\s*\}/,
)?.[0];
assert.ok(trackBranch, "TRACK_FORM_FILL branch must exist");
const afterTrack = background.slice(background.indexOf(trackBranch) + trackBranch.length);
assert.match(afterTrack, /profileService\.loadProfile/, "profile load remains the default branch");
assert.doesNotMatch(
  afterTrack.match(/profileService\.loadProfile[\s\S]*?sendResponse/)?.[0] || afterTrack.slice(0, 200),
  /trackFormFill/,
  "profile load branch must not call trackFormFill",
);

assert.match(content, /gateFormFillUsage/, "content must gate fills");
assert.match(
  content,
  /async function runFillWithRetry[\s\S]*?await gateFormFillUsage\(\)/,
  "runFillWithRetry must gate before filling",
);
assert.match(
  content,
  /type:\s*["']TRACK_FORM_FILL["']/,
  "gate must send TRACK_FORM_FILL to the background",
);
assert.match(content, /completeFormFillUsage/, "completed fills must report their actual fields");
assert.match(trackUsage, /phase === ["']complete["']/, "telemetry endpoint must update completed fill events");
assert.match(popup, /renderUsageLimitNotice/, "popup must render a dedicated usage-limit notice");
assert.match(popup, /USAGE_LIMIT_REACHED/, "popup must distinguish quota notices from errors");
assert.match(popupHtml, /\.status\.limit/, "popup must include the styled quota notification card");
// MutationObserver re-passes call fillForm directly — must not re-gate
assert.match(
  content,
  /watchDynamic[\s\S]*?await fillForm\(profile\)/,
  "dynamic re-pass must call fillForm without a second usage gate",
);

// ── Behavioral: FILL_FORM sends exactly one TRACK_FORM_FILL ─────────────────
const trackCalls = [];
const dom = new JSDOM(
  `<!doctype html><form>
    <label>Full name <input id="name" name="full_name"></label>
    <label>Email <input id="email" type="email"></label>
  </form>`,
  { url: "https://example.com/jobs/apply", runScripts: "outside-only" },
);
const { window } = dom;
Object.assign(globalThis, {
  window,
  document: window.document,
  HTMLInputElement: window.HTMLInputElement,
  HTMLTextAreaElement: window.HTMLTextAreaElement,
  HTMLSelectElement: window.HTMLSelectElement,
  Event: window.Event,
  InputEvent: window.InputEvent,
  KeyboardEvent: window.KeyboardEvent,
  File: window.File,
  Blob: window.Blob,
  MutationObserver: window.MutationObserver,
});
window.CSS = { escape: (value) => String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&") };
Object.defineProperty(window.HTMLElement.prototype, "getBoundingClientRect", {
  value: () => ({ width: 100, height: 24 }),
});

let messageListener;
window.chrome = {
  runtime: {
    getURL: (path) => `chrome-extension://jobai/${path}`,
    onMessage: { addListener: (listener) => { messageListener = listener; } },
    sendMessage: async (msg) => {
      trackCalls.push(msg);
      if (msg?.type === "TRACK_FORM_FILL") return { ok: true, event_id: "fill-event-1" };
      return null;
    },
  },
  storage: {
    local: {
      get: async () => ({
        session: {
          access_token: "test-token",
          user: { id: "test-user", email: "test@example.com" },
        },
      }),
    },
  },
};
globalThis.chrome = window.chrome;
window.fetch = async (url) =>
  String(url).endsWith("config.local.json")
    ? { ok: true, json: async () => ({ supabaseUrl: "https://example.supabase.co", anonKey: "test-anon" }) }
    : { ok: true, blob: async () => new window.Blob(["x"], { type: "application/pdf" }) };

window.eval(fs.readFileSync(new URL("./decision-engine.js", import.meta.url), "utf8"));
window.eval(fs.readFileSync(new URL("./content.js", import.meta.url), "utf8"));
assert.ok(messageListener, "content must register FILL_FORM handler");

const fillResult = await new Promise((resolve) => {
  const async = messageListener(
    {
      type: "FILL_FORM",
      profile: { full_name: "Ayesha Khan", email: "ayesha@example.com" },
    },
    null,
    resolve,
  );
  assert.equal(async, true);
});

assert.equal(fillResult.ok, true);
assert.ok(fillResult.count >= 1, "fill should populate at least one field");
const fillTrackCalls = trackCalls.filter((m) => m?.type === "TRACK_FORM_FILL");
assert.equal(fillTrackCalls.length, 2, "real fill must reserve once and complete the same telemetry event once");
assert.equal(fillTrackCalls[0].phase, undefined, "the first call reserves and meters the fill attempt");
assert.equal(fillTrackCalls[1].phase, "complete", "the second call completes telemetry without another quota charge");
assert.equal(fillTrackCalls[1].event_id, "fill-event-1");
assert.ok(fillTrackCalls[1].fields.length >= 1, "completion must report fields that were actually filled");

// Limit exceeded must surface to the popup as ok:false (no silent fill)
trackCalls.length = 0;
window.chrome.runtime.sendMessage = async (msg) => {
  trackCalls.push(msg);
  if (msg?.type === "TRACK_FORM_FILL") {
    return { ok: false, code: "USAGE_LIMIT_REACHED", feature: "form_fill", used: 1, limit: 1, period: "day", resetsAt: "2026-08-05T00:00:00.000Z", error: "Form Fill daily limit of 1 reached." };
  }
  return null;
};

const blocked = await new Promise((resolve) => {
  messageListener(
    {
      type: "FILL_FORM",
      profile: { full_name: "Blocked User", email: "blocked@example.com" },
    },
    null,
    resolve,
  );
});
assert.equal(blocked.ok, false);
assert.equal(blocked.code, "USAGE_LIMIT_REACHED");
assert.equal(blocked.used, 1);
assert.equal(blocked.limit, 1);
assert.match(blocked.error || "", /limit/i);
assert.equal(window.document.querySelector("#name").value, "Ayesha Khan", "blocked fill must not overwrite prior values");

console.log("Form Fill metering tests passed: profile load unmetered; real fill metered once; limit errors surface.");
