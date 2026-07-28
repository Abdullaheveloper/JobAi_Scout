import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";

const dom = new JSDOM(`<!doctype html><html><body><form>
  <label>LinkedIn profile <input id="linkedin" type="url"></label>
  <label>Expected salary <input id="salary" type="text"></label>
  <label>Education end date <input id="education-end" type="date"></label>
</form></body></html>`, {
  url: "https://jobs.example.com/apply",
  runScripts: "outside-only",
});

const { window } = dom;
Object.defineProperty(window.HTMLElement.prototype, "innerText", {
  configurable: true,
  get() { return this.textContent; },
  set(value) { this.textContent = value; },
});
Object.defineProperty(window.HTMLElement.prototype, "getBoundingClientRect", {
  configurable: true,
  value: () => ({ width: 320, height: 40 }),
});
window.CSS = { escape: (value) => String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&") };

Object.assign(globalThis, {
  window,
  document: window.document,
  location: window.location,
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

let messageListener;
window.chrome = {
  runtime: {
    getURL: (path) => `chrome-extension://jobai/${path}`,
    onMessage: { addListener: (listener) => { messageListener = listener; } },
    sendMessage: async () => ({ ok: true, answer: null, insufficient_data: true }),
  },
  storage: {
    local: {
      get: async () => ({
        session: { access_token: "test-token", user: { id: "test-user" } },
      }),
    },
  },
};
globalThis.chrome = window.chrome;
window.fetch = async () => ({ ok: false });

window.eval(fs.readFileSync(new URL("./decision-engine.js", import.meta.url), "utf8"));
window.eval(fs.readFileSync(new URL("./content.js", import.meta.url), "utf8"));

const profile = {
  linkedin_url: "https://linkedin.com/in/test-user",
  expected_salary: "$120,000",
  education: "",
  career_profile: {
    education: [{
      institution: "National University of Technology",
      degree: "BS Computer Science",
      endDate: "2024-06",
    }],
  },
};

const result = await new Promise((resolve) => {
  messageListener({ type: "FILL_FORM", profile }, null, resolve);
});

assert.equal(document.querySelector("#linkedin").value, "https://linkedin.com/in/test-user");
assert.equal(document.querySelector("#education-end").value, "2024-06-01");

const missingKeys = new Set(result.missing || []);
const suggestionKeys = new Set((result.suggestions || []).map((item) => item.key));
assert.equal(missingKeys.has("linkedin"), false, "linkedin must not be missing when linkedin_url is saved");
assert.equal(missingKeys.has("education_end_date"), false, "education end date must come from career_profile.education");
assert.equal(missingKeys.has("salary"), false, "salary must not be missing when expected_salary is saved");
assert.ok(
  suggestionKeys.has("salary") && result.suggestions.some((item) => item.reason === "salary-requires-confirm"),
  "salary with a saved value must require explicit review, not auto-fill",
);

console.log("Profile mapping regression test passed.");
