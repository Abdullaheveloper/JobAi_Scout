import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";

// Regression fixture modelled on Google Forms. Its generated field names carry
// no semantics, so the extension must use each role=listitem question heading.
const dom = new JSDOM(`<!doctype html><html><body><form>
  <div role="listitem">
    <div role="heading" class="M7eMe">Graduation Year <span>*</span></div>
    <input id="graduation" name="entry.101" type="date" aria-label="Date">
  </div>
  <div role="listitem">
    <div role="heading" class="M7eMe">University Name</div>
    <input id="university" name="entry.102" type="text" aria-label="Your answer">
  </div>
  <div role="listitem">
    <div role="heading" class="M7eMe">Total Years of Experience <span>*</span></div>
    <input id="experience" name="entry.103" type="number" aria-label="Your answer">
  </div>
  <div role="listitem">
    <div role="heading" class="M7eMe">Current Employer <span>*</span></div>
    <input id="employer" name="entry.104" type="text" aria-label="Your answer">
  </div>
  <div role="listitem">
    <div role="heading" class="M7eMe">Are you comfortable commuting to the office in Gulberg Greens? <span>*</span></div>
    <label><input id="commute-yes" type="radio" name="entry.105" value="yes"> Yes</label>
    <label><input id="commute-no" type="radio" name="entry.105" value="no"> No</label>
  </div>
  <div role="listitem" id="resume-question">
    <div role="heading" class="M7eMe">Resume (updated) <span>*</span></div>
    <div>Upload 1 supported file. Max 10 MB.</div>
    <!-- Google Forms exposes a picker button, not a writable input[type=file]
         in the form DOM. Opening the authenticated picker remains manual. -->
    <div role="button" tabindex="0" aria-label="Add file">Add file</div>
  </div>
</form></body></html>`, {
  url: "https://docs.google.com/forms/d/e/jobai-regression/viewform",
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
assert.ok(messageListener, "Content script must register its fill message handler");

const applicantName = "Abdullah Waheed";
const result = await new Promise((resolve) => {
  const asyncResponse = messageListener({
    type: "FILL_FORM",
    profile: {
      full_name: applicantName,
      // Deliberately corrupted legacy value: even if legacy `education` once
      // received the applicant name, University Name must use the Career
      // Passport institution and must never leak full_name into this field.
      education: applicantName,
      experience_years: 1,
      current_company: "JobAI Scout",
      work_type: "onsite",
      location: "Gulberg Greens, Islamabad",
      resume_url: "test-user/resume.pdf",
      career_profile: {
        education: [{
          institution: "National University of Technology",
          degree: "BS Computer Science",
          endDate: "2024-06",
        }],
        experiences: [{
          company: "JobAI Scout",
          title: "Software Engineer",
          isCurrent: true,
        }],
      },
    },
  }, null, resolve);
  assert.equal(asyncResponse, true);
});

const actual = {
  graduationDate: document.querySelector("#graduation").value,
  university: document.querySelector("#university").value,
  universityContainsApplicantName: document.querySelector("#university").value === applicantName,
  experienceYears: document.querySelector("#experience").value,
  currentEmployer: document.querySelector("#employer").value,
  commuteYes: document.querySelector("#commute-yes").checked,
  commuteNo: document.querySelector("#commute-no").checked,
  resumeUploadAutomated: result.fields.includes("resume"),
};

assert.deepEqual(actual, {
  graduationDate: "2024-06-01",
  university: "National University of Technology",
  universityContainsApplicantName: false,
  experienceYears: "1",
  currentEmployer: "JobAI Scout",
  commuteYes: true,
  commuteNo: false,
  // Google Forms owns the authenticated upload picker and exposes no writable
  // file input here. The extension must leave this control for the applicant.
  resumeUploadAutomated: false,
});
assert.ok(
  result.suggestions.some((item) => item.key === "resume" && item.reason === "google-file-picker-required"),
  "Google's authenticated file picker must be explained as a manual review item",
);

console.log("Google Forms regression test passed.");
