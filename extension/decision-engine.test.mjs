import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("./decision-engine.js", import.meta.url), "utf8");
const sandbox = { console };
sandbox.globalThis = sandbox;
vm.runInNewContext(source, sandbox, { filename: "decision-engine.js" });

const engine = sandbox.JobAIFormDecisionEngine;
assert.ok(engine, "The decision engine must register on globalThis");

function decision(input) {
  return engine.decide(input);
}

// Hard manual protections take precedence over evidence and confidence.
for (const [label, category] of [
  ["I agree to the Terms and Conditions", "legal"],
  ["Privacy policy consent", "legal"],
  ["Applicant declaration", "legal"],
  ["Voluntary self-identification: disability status", "sensitive"],
  ["Veteran status", "sensitive"],
  ["Ethnicity", "sensitive"],
  ["CAPTCHA verification", "protected"],
  ["Enter the one-time passcode", "protected"],
  ["Coding assessment answer", "protected"],
  ["Final submit application", "protected"],
]) {
  const result = decision({
    field: { context: label, type: "checkbox" },
    value: "yes",
    confidence: 1,
    evidence: { direct: true },
  });
  assert.equal(result.action, "manual", `${label} must always remain manual`);
  assert.equal(result.classification.category, category);
  assert.equal(result.canFill, false);
}

// Confidence boundaries are explicit and stable whether the caller uses 0–1
// fractions or 0–100 percentages.
const emailField = { key: "email", type: "email", context: "Applicant email" };
assert.equal(decision({ field: emailField, value: "user@example.com", confidence: 39 }).action, "leave_blank");
assert.equal(decision({ field: emailField, value: "user@example.com", confidence: 40 }).action, "suggest");

const reviewFill = decision({ field: emailField, value: "user@example.com", confidence: 0.75 });
assert.equal(reviewFill.action, "fill_with_review");
assert.equal(reviewFill.requiresReview, true);
assert.equal(reviewFill.canFill, true);

assert.equal(
  decision({ field: emailField, value: "user@example.com", confidence: 0.89 }).action,
  "fill_with_review"
);
assert.equal(
  decision({ field: emailField, value: "user@example.com", confidence: 90 }).action,
  "suggest",
  "High confidence alone is not direct evidence"
);

const directEmail = decision({
  field: emailField,
  value: "user@example.com",
  confidence: 90,
  evidence: { source: "verified_profile" },
});
assert.equal(directEmail.action, "autofill");
assert.equal(directEmail.reason, "direct-safe-factual-evidence");

// Unknown prompts are never treated as safe facts, even at 100% confidence.
assert.equal(
  decision({
    field: { context: "Why are you the best candidate?", type: "textarea" },
    value: "Because I am a strong fit.",
    confidence: 1,
    evidence: { direct: true },
  }).action,
  "suggest"
);

// A select is not a low-risk text field in the review-fill band.
assert.equal(
  decision({
    field: { key: "work_type", type: "select", context: "Preferred work type" },
    value: "remote",
    confidence: 0.8,
  }).action,
  "suggest"
);

// A checkbox/radio may only be touched with a non-sensitive direct profile fact
// at 90%+. Truthful No stays present and can be selected.
const relocationCheckbox = {
  key: "willing_to_relocate",
  type: "checkbox",
  context: "Are you willing to relocate?",
};
assert.equal(
  decision({ field: relocationCheckbox, value: "no", confidence: 0.89, evidence: { direct: true } }).action,
  "suggest"
);
const directNo = decision({
  field: relocationCheckbox,
  value: false,
  confidence: 0.9,
  evidence: { direct: true },
});
assert.equal(directNo.action, "autofill");
assert.equal(directNo.value, "no");
assert.equal(engine.normalizeAnswer("No"), "no");
assert.equal(engine.normalizeAnswer(false), "no");
assert.notEqual(engine.normalizeAnswer("no"), null);

// Missing values cannot become invented answers.
assert.equal(
  decision({ field: emailField, value: "   ", confidence: 1, evidence: { direct: true } }).action,
  "leave_blank"
);

console.log("Decision engine safety tests passed.");
