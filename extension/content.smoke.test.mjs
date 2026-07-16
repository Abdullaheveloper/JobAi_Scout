import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";

const dom = new JSDOM(`<!doctype html><form aria-label="Job application">
  <label>Full name <input id="name" name="full_name"></label>
  <label>Email <input id="email" type="email"></label>
  <label>Years of professional software experience <input id="experience" type="number"></label>
  <label>Are you able to work onsite in Karachi?<select id="onsite"><option value="">Select</option><option value="yes">Yes</option><option value="no">No</option></select></label>
  <label>Can you start within 4 weeks?<select id="start"><option value="">Select</option><option value="yes">Yes</option><option value="no">No</option></select></label>
  <fieldset><legend>Authorized to work?</legend><label>Yes <input type="radio" name="authorized" value="yes"></label><label>No <input type="radio" name="authorized" value="no"></label></fieldset>
  <label>Willing to relocate <input id="relocate" type="checkbox"></label>
  <label>Have you deployed and debugged an application on a Linux server?<select id="linux"><option value="">Select</option><option value="yes">Yes</option><option value="no">No</option></select></label>
  <label>Upload resume <input id="resume" type="file"></label>
</form>`, { url: "https://example.com/jobs/apply", runScripts: "outside-only" });

const { window } = dom;
Object.assign(globalThis, {
  window, document: window.document, HTMLInputElement: window.HTMLInputElement,
  HTMLTextAreaElement: window.HTMLTextAreaElement, HTMLSelectElement: window.HTMLSelectElement,
  Event: window.Event, InputEvent: window.InputEvent, KeyboardEvent: window.KeyboardEvent,
  File: window.File, Blob: window.Blob, MutationObserver: window.MutationObserver,
});
window.CSS = { escape: (value) => String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&") };
Object.defineProperty(window.HTMLElement.prototype, "getBoundingClientRect", { value: () => ({ width: 100, height: 24 }) });

class FakeDataTransfer {
  #file;
  items = { add: (file) => { this.#file = file; } };
  get files() { return { 0: this.#file, length: this.#file ? 1 : 0, item: (index) => index === 0 ? this.#file : null }; }
}
window.DataTransfer = FakeDataTransfer;
Object.defineProperty(window.document.querySelector("#resume"), "files", { configurable: true, writable: true, value: null });

let messageListener;
window.chrome = {
  runtime: { onMessage: { addListener: (listener) => { messageListener = listener; } } },
  storage: { local: { get: async () => ({ session: { access_token: "test-token", user: { id: "test-user", email: "test@example.com" } } }) } },
};
globalThis.chrome = window.chrome;
window.fetch = async () => ({ ok: true, blob: async () => new window.Blob(["resume"], { type: "application/pdf" }) });

window.eval(fs.readFileSync(new URL("./content.js", import.meta.url), "utf8"));
assert.ok(messageListener, "Content script must register its fill message handler");

const result = await new Promise((resolve) => {
  const asyncResponse = messageListener({ type: "FILL_FORM", profile: {
    full_name: "Ayesha Khan", email: "ayesha@example.com", experience_years: 4,
    location: "Karachi, Pakistan", work_type: "onsite", availability: "Immediately",
    work_authorization: "yes", willing_to_relocate: "yes", resume_url: "test-user/resume.pdf",
    application_answers: { "deployed and debugged an application on a linux server": "yes" },
  } }, null, resolve);
  assert.equal(asyncResponse, true);
});

assert.equal(window.document.querySelector("#name").value, "Ayesha Khan");
assert.equal(window.document.querySelector("#email").value, "ayesha@example.com");
assert.equal(window.document.querySelector("#experience").value, "4");
assert.equal(window.document.querySelector("#onsite").value, "yes");
assert.equal(window.document.querySelector("#start").value, "yes");
assert.equal(window.document.querySelector('input[name="authorized"][value="yes"]').checked, true);
assert.equal(window.document.querySelector("#relocate").checked, true);
assert.equal(window.document.querySelector("#linux").value, "yes");
assert.equal(window.document.querySelector("#resume").files.length, 1);
assert.equal(result.missing.length, 0);
console.log(`Extension smoke test passed: ${result.count} fields filled.`);
