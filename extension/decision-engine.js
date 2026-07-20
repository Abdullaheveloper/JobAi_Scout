// JobAI Form-Fill Safety Decision Engine
//
// This is deliberately dependency-free so it can run as a classic Chrome content
// script before content.js.  It does not touch the DOM or fill a field itself:
// callers pass a candidate value plus evidence and receive a safe action.
//
// Safety contract:
//   - 0–39%: leave blank
//   - 40–74%: show a suggestion only
//   - 75–89%: fill only a low-risk text field and mark it for review
//   - 90%+: fill only a safe factual field backed by direct evidence
//   - Checkboxes/radios require direct, non-sensitive evidence at 90%+
//   - Legal, sensitive, protected, challenge, and final-submit fields are
//     always left for the applicant, regardless of confidence.
(function installJobAIDecisionEngine(root) {
  "use strict";

  if (root.JobAIFormDecisionEngine) return;

  const POLICY = Object.freeze({
    suggestAt: 0.4,
    reviewFillAt: 0.75,
    directFillAt: 0.9,
  });

  // A field in one of these groups must never be completed by automation. The
  // patterns intentionally err on the side of user control: a false positive
  // results in a review prompt, not an unwanted application decision.
  const PROTECTED_PATTERNS = [
    /\b(?:re)?captcha\b/i,
    /\bhcaptcha\b/i,
    /\bturnstile\b/i,
    /\botp\b/i,
    /\bone[\s-]?time(?:\s+(?:pass(?:word)?|code))?\b/i,
    /\bverification\s*(?:code|pin)\b/i,
    /\bsecurity\s*(?:code|pin)\b/i,
    /\b(?:two|2)[\s-]?(?:factor|step)\b/i,
    /\bassessment\b/i,
    /\bcoding\s+(?:challenge|test)\b/i,
    /\b(?:exam|quiz)\b/i,
    /\b(?:social security|national id|passport number|bank account)\b/i,
    /\b(?:password|passcode)\b/i,
    /\b(?:final\s+)?submit(?:\s+(?:application|form))?\b/i,
    /\b(?:review\s+and\s+)?submit\b/i,
  ];

  const LEGAL_PATTERNS = [
    /\bterms(?:\s+(?:of|and)\s+(?:service|conditions))?\b/i,
    /\bconditions\b/i,
    /\bprivacy\s+policy\b/i,
    /\bconsent\b/i,
    /\b(?:i\s+)?agree\b/i,
    /\baccept(?:ance)?\b/i,
    /\backnowledg(?:e|ement)\b/i,
    /\bdeclar(?:e|ation)\b/i,
    /\bcertif(?:y|ication)\b/i,
    /\bwaiver\b/i,
    /\brelease\b/i,
    /\bauthori[sz]e(?:\s+(?:a\s+)?)?(?:background|background check)\b/i,
    /\bbackground\s+check\b/i,
  ];

  const SENSITIVE_PATTERNS = [
    /\bdiversity\b/i,
    /\beeo\b/i,
    /\bequal\s+employment\b/i,
    /\bself[\s-]?identif/i,
    /\bgender\b/i,
    /\bsex\b/i,
    /\bsexual\s+orientation\b/i,
    /\brace\b/i,
    /\bethnic(?:ity|\b)/i,
    /\bveteran\b/i,
    /\bdisab(?:ility|led)\b/i,
    /\breligion\b/i,
    /\bbelief\b/i,
    /\bpronoun\b/i,
    /\bmarital\s+status\b/i,
    /\bpregnan(?:cy|t)\b/i,
    /\bdate\s+of\s+birth\b/i,
    /\bbirth\s*date\b/i,
    /\bage\b/i,
    /\bnationality\b/i,
    /\bcitizenship\b/i,
  ];

  // These keys represent ordinary, factual profile data. A field outside this
  // allowlist can be suggested, but should not be populated automatically.
  const SAFE_FACTUAL_KEYS = new Set([
    "full_name", "first_name", "last_name", "email", "phone", "location",
    "linkedin", "github", "portfolio", "portfolio_url", "website",
    "current_company", "company", "job_title", "current_title",
    "education", "degree", "school", "university", "field_of_study",
    "experience", "experience_years", "years_of_experience", "skills",
    "experience_title", "experience_company", "experience_start_date", "experience_end_date", "experience_description",
    "education_institution", "education_degree", "education_field", "education_start_date", "education_end_date",
    "project_name", "project_role", "project_url", "project_description",
    "reference_full_name", "reference_company", "reference_email", "reference_phone", "reference_relationship",
    "willing_to_relocate", "work_type", "availability", "onsite_eligible",
    "work_authorization", "start_within_4_weeks", "linux_vps_experience",
    "commute_to_office", "graduation_year",
  ]);

  // At 75–89%, only these text-entry fields may be filled, and the UI must
  // clearly mark the value as requiring the applicant's review.
  const LOW_RISK_TEXT_KEYS = new Set([
    "full_name", "first_name", "last_name", "email", "phone", "location",
    "linkedin", "github", "portfolio", "portfolio_url", "website",
    "current_company", "company", "job_title", "current_title",
    "education", "degree", "school", "university", "field_of_study",
    "experience", "experience_years", "years_of_experience", "skills", "work_authorization",
    "commute_to_office", "graduation_year",
    "experience_title", "experience_company", "experience_description",
    "education_institution", "education_degree", "education_field",
    "project_name", "project_role", "project_url", "project_description",
    "reference_full_name", "reference_company", "reference_email", "reference_phone", "reference_relationship",
  ]);

  const KEY_PATTERNS = [
    { key: "email", patterns: [/\be[\s-]?mail\b/i] },
    { key: "phone", patterns: [/\b(?:phone|mobile|telephone|tel)\b/i] },
    { key: "first_name", patterns: [/\b(?:first|given|forename)\s+name\b/i] },
    { key: "last_name", patterns: [/\b(?:last|family|sur)name\b/i] },
    { key: "full_name", patterns: [/\b(?:full|legal|applicant|candidate)\s+name\b/i] },
    { key: "linkedin", patterns: [/\blinked[\s-]?in\b/i] },
    { key: "github", patterns: [/\bgit[\s-]?hub\b/i] },
    { key: "portfolio", patterns: [/\b(?:portfolio|personal\s+(?:site|website))\b/i] },
    { key: "location", patterns: [/\b(?:location|city|address|region|country)\b/i] },
    { key: "experience_years", patterns: [/\b(?:years?\s+(?:of\s+)?)?(?:professional\s+)?experience\b/i] },
    { key: "skills", patterns: [/\b(?:skills?|technologies|competencies)\b/i] },
    { key: "education", patterns: [/\b(?:education|degree|university|college|school)\b/i] },
    { key: "willing_to_relocate", patterns: [/\b(?:willing\s+to\s+relocate|relocation)\b/i] },
    { key: "work_type", patterns: [/\b(?:work\s+(?:type|mode)|remote|hybrid|on[\s-]?site)\b/i] },
    { key: "availability", patterns: [/\b(?:availability|available\s+to\s+start|start\s+date)\b/i] },
  ];

  function asString(value) {
    return value === undefined || value === null ? "" : String(value);
  }

  function compactText(value) {
    return asString(value).replace(/\s+/g, " ").trim();
  }

  function normalizeKey(value) {
    return compactText(value).toLowerCase().replace(/[\s-]+/g, "_");
  }

  /**
   * Canonicalizes an answer without treating false/no/0 as missing. This fixes
   * the common auto-fill bug where a truthful "no" vanishes before selection.
   */
  function normalizeAnswer(value) {
    if (value === undefined || value === null) return null;
    if (value === true) return "yes";
    if (value === false) return "no";
    if (Array.isArray(value)) {
      const values = value
        .map(normalizeAnswer)
        .filter((item) => item !== null && item !== "");
      return values.length ? values.join(", ") : null;
    }
    if (typeof value === "number") return Number.isFinite(value) ? String(value) : null;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return null;
      if (/^(?:no|false)$/i.test(trimmed)) return "no";
      if (/^(?:yes|true)$/i.test(trimmed)) return "yes";
      return trimmed;
    }
    return null;
  }

  function normalizeConfidence(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    // Accept both fractional confidence (0.9) and percentage confidence (90).
    const fractional = parsed > 1 ? parsed / 100 : parsed;
    return Math.min(1, Math.max(0, fractional));
  }

  function readFieldText(field) {
    if (typeof field === "string") return compactText(field).toLowerCase();
    const source = field || {};
    const attributes = [
      source.context, source.text, source.label, source.name, source.id,
      source.placeholder, source.key, source.fieldKey, source.autocomplete,
      source.ariaLabel, source.title,
    ];

    if (typeof source.getAttribute === "function") {
      attributes.push(
        source.getAttribute("aria-label"),
        source.getAttribute("autocomplete"),
        source.getAttribute("data-automation-id"),
        source.getAttribute("data-testid"),
      );
    }

    return compactText(attributes.filter(Boolean).join(" ")).toLowerCase();
  }

  function readControlType(field) {
    const source = field || {};
    const declared = compactText(
      source.controlType || source.fieldType || source.inputType || source.type || ""
    ).toLowerCase();
    const tag = compactText(source.tagName || source.tag || "").toLowerCase();
    const role = compactText(source.role || (typeof source.getAttribute === "function" && source.getAttribute("role")) || "").toLowerCase();

    if (declared === "checkbox" || declared === "radio" || declared === "submit" || declared === "button") return declared;
    if (tag === "textarea") return "textarea";
    if (tag === "select") return "select";
    if (tag === "button") return declared || "button";
    if (role === "textbox") return "text";
    if (role === "combobox") return "select";
    if (source.isContentEditable || source.contentEditable === "true") return "contenteditable";
    return declared || "text";
  }

  function inferKey(field, context) {
    const explicit = normalizeKey(field && (field.key || field.fieldKey || field.semanticKey));
    if (explicit) return explicit;
    for (const matcher of KEY_PATTERNS) {
      if (matcher.patterns.some((pattern) => pattern.test(context))) return matcher.key;
    }
    return "";
  }

  function firstMatchingPattern(patterns, text) {
    return patterns.find((pattern) => pattern.test(text)) || null;
  }

  function isCheckable(controlType) {
    return controlType === "checkbox" || controlType === "radio";
  }

  function isLowRiskTextControl(controlType) {
    return ["text", "textarea", "email", "tel", "url", "search", "contenteditable"].includes(controlType);
  }

  function hasDirectEvidence(evidence) {
    if (evidence === true) return true;
    if (typeof evidence === "string") {
      return ["direct", "explicit", "verified", "user_confirmed"].includes(
        normalizeKey(evidence)
      );
    }
    if (!evidence || typeof evidence !== "object") return false;
    if (evidence.direct === true || evidence.explicit === true || evidence.verified === true) return true;
    const source = normalizeKey(evidence.source || evidence.kind);
    return source === "user_confirmed" || source === "verified_profile" || source === "direct_profile";
  }

  /**
   * Determines whether a field is legally or personally protected before any
   * confidence calculation is considered.
   */
  function classifyField(field) {
    const context = readFieldText(field);
    const controlType = readControlType(field);
    const key = inferKey(field, context);

    const protectedMatch = firstMatchingPattern(PROTECTED_PATTERNS, context);
    if (protectedMatch || controlType === "submit") {
      return {
        category: "protected",
        manualOnly: true,
        key,
        controlType,
        context,
        matched: protectedMatch ? protectedMatch.source : "submit control",
        safety: "manual_only",
      };
    }

    const legalMatch = firstMatchingPattern(LEGAL_PATTERNS, context);
    if (legalMatch) {
      return {
        category: "legal",
        manualOnly: true,
        key,
        controlType,
        context,
        matched: legalMatch.source,
        safety: "manual_only",
      };
    }

    const sensitiveMatch = firstMatchingPattern(SENSITIVE_PATTERNS, context);
    if (sensitiveMatch) {
      return {
        category: "sensitive",
        manualOnly: true,
        key,
        controlType,
        context,
        matched: sensitiveMatch.source,
        safety: "manual_only",
      };
    }

    const safeFactual = SAFE_FACTUAL_KEYS.has(key);
    const lowRiskText = LOW_RISK_TEXT_KEYS.has(key);
    return {
      category: safeFactual ? "safe" : "unknown",
      manualOnly: false,
      key,
      controlType,
      context,
      matched: null,
      safety: safeFactual ? "safe_factual" : (lowRiskText ? "low_risk_text" : "unknown"),
      safeFactual,
      lowRiskText,
    };
  }

  function makeDecision(action, details) {
    const canFill = action === "autofill" || action === "fill_with_review";
    return Object.assign({
      action,
      canFill,
      requiresReview: action === "suggest" || action === "fill_with_review" || action === "manual",
    }, details);
  }

  /**
   * Returns an action for a single potential fill. `evidence` must explicitly
   * say direct/verified/explicit for a 90%+ automatic action. AI inference or
   * a confidence score alone is intentionally insufficient.
   */
  function decide(options) {
    const input = options || {};
    const classification = classifyField(input.field || input);
    const confidence = normalizeConfidence(input.confidence);
    const value = normalizeAnswer(input.value);
    const directEvidence = hasDirectEvidence(input.evidence);

    const base = {
      value,
      confidence,
      confidencePercent: Math.round(confidence * 100),
      directEvidence,
      classification,
    };

    if (classification.manualOnly) {
      return makeDecision("manual", Object.assign(base, {
        reason: `manual-${classification.category}-field`,
      }));
    }

    if (value === null) {
      return makeDecision("leave_blank", Object.assign(base, { reason: "missing-value" }));
    }

    if (confidence < POLICY.suggestAt) {
      return makeDecision("leave_blank", Object.assign(base, { reason: "confidence-below-40" }));
    }

    const checkable = isCheckable(classification.controlType);
    if (confidence < POLICY.reviewFillAt) {
      return makeDecision("suggest", Object.assign(base, { reason: "review-suggestion-40-to-74" }));
    }

    if (confidence < POLICY.directFillAt) {
      if (!checkable && classification.lowRiskText && isLowRiskTextControl(classification.controlType)) {
        return makeDecision("fill_with_review", Object.assign(base, {
          reason: "low-risk-text-review-75-to-89",
        }));
      }
      return makeDecision("suggest", Object.assign(base, {
        reason: checkable ? "checkable-requires-direct-evidence-at-90" : "field-requires-review",
      }));
    }

    if (!classification.safeFactual) {
      return makeDecision("suggest", Object.assign(base, { reason: "not-a-safe-factual-field" }));
    }

    if (!directEvidence) {
      return makeDecision("suggest", Object.assign(base, { reason: "direct-evidence-required" }));
    }

    // The manual-only checks above intentionally happen first, so a checked
    // terms/privacy/declaration field never reaches this branch.
    return makeDecision("autofill", Object.assign(base, {
      reason: checkable ? "explicit-checkable-evidence" : "direct-safe-factual-evidence",
    }));
  }

  root.JobAIFormDecisionEngine = Object.freeze({
    POLICY,
    classifyField,
    decide,
    normalizeAnswer,
    normalizeConfidence,
    hasDirectEvidence,
    isCheckable,
  });
})(typeof globalThis !== "undefined" ? globalThis : window);
