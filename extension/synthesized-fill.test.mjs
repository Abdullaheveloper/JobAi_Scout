import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";

const dom = new JSDOM(`<!doctype html><form>
  <label>Expected salary <input id="salary" name="salary"></label>
  <label>Why should we hire you? <textarea id="why" name="why"></textarea></label>
  <label>Describe a project you are proud of <textarea id="project" name="project"></textarea></label>
</form>`, { url: "https://example.com/apply", runScripts: "outside-only" });

const { window } = dom;
Object.assign(globalThis, {
  window, document: window.document, HTMLInputElement: window.HTMLInputElement,
  HTMLTextAreaElement: window.HTMLTextAreaElement, HTMLSelectElement: window.HTMLSelectElement,
  Event: window.Event, InputEvent: window.InputEvent, KeyboardEvent: window.KeyboardEvent,
  MutationObserver: window.MutationObserver,
});
window.CSS = { escape: (value) => String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&") };
Object.defineProperty(window.HTMLElement.prototype, "getBoundingClientRect", { value: () => ({ width: 100, height: 24 }) });

let synthesisCalls = 0;
let messageListener;
window.chrome = {
  runtime: {
    getURL: (path) => `chrome-extension://jobai/${path}`,
    onMessage: { addListener: (listener) => { messageListener = listener; } },
    sendMessage: async (message) => {
      if (message?.type === "SYNTHESIZE_FORM_ANSWER") {
        synthesisCalls += 1;
        return {
          ok: true,
          answer: "I led a migration project using Docker and Linux, described in my saved profile.",
          insufficient_data: false,
        };
      }
      return null;
    },
  },
};
globalThis.chrome = window.chrome;
window.fetch = async () => ({ ok: false });

window.eval(fs.readFileSync(new URL("./decision-engine.js", import.meta.url), "utf8"));
window.eval(fs.readFileSync(new URL("./content.js", import.meta.url), "utf8"));
assert.ok(messageListener, "Content script must register its fill message handler");

const engine = window.JobAIFormDecisionEngine;
assert.equal(
  engine.resolveFillTier({
    field: { key: "salary", context: "Expected salary", type: "text" },
    decision: engine.decide({
      field: { key: "salary", context: "Expected salary", type: "text" },
      value: "$120,000",
      confidence: 1,
      evidence: { source: "verified_profile" },
    }),
    key: "salary",
    value: "$120,000",
  }).forceConfirm,
  true,
);

const profile = {
  full_name: "Ayesha Khan",
  expected_salary: "$120,000",
  career_profile: {
    experiences: [{ title: "Engineer", company: "Acme", summary: "Built APIs", highlights: ["Docker"] }],
    projects: [{ name: "Migration", description: "Moved services to Linux VPS" }],
  },
  skills: ["Docker", "Linux"],
};

const result = await new Promise((resolve) => {
  const asyncResponse = messageListener({ type: "FILL_FORM", profile }, null, resolve);
  assert.equal(asyncResponse, true);
});

assert.equal(window.document.querySelector("#salary").value, "", "salary is never pre-approved in the form");
assert.ok(result.suggestions.some((item) => item.key === "salary"), "salary appears in decision review");
assert.ok(synthesisCalls >= 1, "open-ended field triggers synthesis");
assert.ok(result.tiers?.synthesized?.length >= 1, "synthesized tier populated");
assert.ok(window.document.querySelector("#why").value.length > 10, "synthesized answer fills open-ended textarea");
assert.ok(Array.isArray(result.tiers?.missing_data), "missing_data tier present in result");

console.log("Synthesized fill extension tests passed.");
