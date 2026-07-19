// JobAI Auto-Fill Engine
// Semantic NLP-style field classification, Shadow DOM walking, human-like typing.
// Supports: text inputs, textareas, selects, radio buttons, checkboxes, file uploads.
(function () {
  if (window.__JOBAI_CONTENT_LOADED__) return;
  window.__JOBAI_CONTENT_LOADED__ = true;

  const LOG = (...a) => console.log("%c[JobAI]", "color:#6366f1;font-weight:bold", ...a);
  const WARN = (...a) => console.warn("[JobAI]", ...a);
  const DECISION_ENGINE = globalThis.JobAIFormDecisionEngine || null;

  const SEMANTICS = [
    // Structured repeatable sections are checked before generic matches so a
    // single career passport can power multiple jobs, degrees and projects.
    { key: "experience_title", patterns: [/\b(?:job|work|employment|professional)\s+(?:title|role)\b/i, /\btitle\b/i] },
    { key: "experience_company", patterns: [/\b(?:work|employment|professional)\s+(?:company|employer)\b/i, /\bcompany\s+name\b/i] },
    { key: "experience_start_date", patterns: [/\b(?:employment|work|job)\s+(?:start|from|begin)\b/i, /\bstart\s+date\b/i] },
    { key: "experience_end_date", patterns: [/\b(?:employment|work|job)\s+(?:end|to|until)\b/i, /\bend\s+date\b/i] },
    { key: "experience_description", patterns: [/\b(?:employment|work|job)\s+(?:duties|responsibilities|description)\b/i, /\bjob\s+description\b/i] },
    { key: "education_institution", patterns: [/\b(?:education|academic)\s+(?:institution|school|university|college)\b/i, /\b(?:university|college|school|institution)\s+name\b/i] },
    { key: "education_degree", patterns: [/\b(?:education|academic)\s+(?:degree|qualification)\b/i] },
    { key: "education_field", patterns: [/\b(?:field|area)\s+of\s+study\b/i, /\bmajor\b/i] },
    { key: "education_start_date", patterns: [/\beducation\s+(?:start|from)\b/i] },
    { key: "education_end_date", patterns: [/\beducation\s+(?:end|to|graduation)\b/i, /\bgraduation\s+(?:date|year)\b/i, /\byear\s+of\s+graduation\b/i] },
    { key: "project_name", patterns: [/\bproject\s+(?:name|title)\b/i] },
    { key: "project_description", patterns: [/\bproject\s+(?:description|summary)\b/i] },
    { key: "project_url", patterns: [/\bproject\s+(?:url|link|website)\b/i] },
    { key: "reference_name", patterns: [/\breference\s+(?:full\s+)?name\b/i] },
    { key: "reference_email", patterns: [/\breference\s+(?:e[\s-]?mail)\b/i] },
    { key: "reference_phone", patterns: [/\breference\s+(?:phone|mobile)\b/i] },
    { key: "reference_company", patterns: [/\breference\s+(?:company|employer)\b/i] },
    { key: "reference_relationship", patterns: [/\breference\s+(?:relationship|relationship\s+to\s+you)\b/i] },
    { key: "email",      patterns: [/\b(e[\s-]?mail|email address|work email|contact email)\b/i] },
    { key: "phone",      patterns: [/\b(phone|tel(ephone)?|mobile|cell|whatsapp|contact number|phone number)\b/i] },
    { key: "first_name", patterns: [/\b(first name|given name|forename|f[\s-]?name|fname)\b/i, /given-name/i] },
    { key: "last_name",  patterns: [/\b(last name|family name|surname|l[\s-]?name|lname)\b/i, /family-name/i] },
    { key: "full_name",  patterns: [/\b(full name|your name|applicant name|candidate name|legal name)\b/i] },
    { key: "linkedin",   patterns: [/linked[\s-]?in|linkedin url|linkedin profile/i] },
    { key: "github",     patterns: [/git[\s-]?hub|github url|github profile/i] },
    { key: "portfolio",  patterns: [/portfolio|personal (site|website)|website|web url/i] },
    { key: "location",   patterns: [/\b(location|city|address|town|region|where.*based|country)\b/i] },
    { key: "experience_title", patterns: [/\b(job|position|role) title\b/i, /\btitle.*(?:work|employment|experience)\b/i] },
    { key: "experience_company", patterns: [/\b(?:employer|company|organization).*(?:work|employment|experience)\b/i, /\b(?:work|employment|experience).*(?:employer|company|organization)\b/i] },
    { key: "experience_start_date", patterns: [/\b(?:work|employment|experience).*(?:start|from) date\b/i, /\bstart date.*(?:work|employment|experience)\b/i] },
    { key: "experience_end_date", patterns: [/\b(?:work|employment|experience).*(?:end|to) date\b/i, /\bend date.*(?:work|employment|experience)\b/i] },
    { key: "experience_description", patterns: [/\b(?:work|employment|experience).*(?:description|responsibilit|achievement|duties)\b/i] },
    { key: "education_institution", patterns: [/\b(?:school|college|university|institution).*\b(?:education|degree|academic)\b/i, /\b(?:education|degree|academic).*\b(?:school|college|university|institution)\b/i] },
    { key: "education_degree", patterns: [/\b(?:degree|qualification|major).*\b(?:education|academic)\b/i, /\b(?:education|academic).*\b(?:degree|qualification|major)\b/i] },
    { key: "education_field", patterns: [/\b(?:field of study|area of study|major|speciali[sz]ation)\b/i] },
    { key: "education_start_date", patterns: [/\b(?:education|academic).*(?:start|from) date\b/i] },
    { key: "education_end_date", patterns: [/\b(?:education|academic).*(?:end|graduation|to) date\b/i] },
    { key: "project_name", patterns: [/\bproject name\b/i] },
    { key: "project_role", patterns: [/\b(?:project )?(?:role|position)\b/i] },
    { key: "project_url", patterns: [/\b(?:project|repository|demo).*(?:url|link|website)\b/i] },
    { key: "project_description", patterns: [/\bproject.*(?:description|summary|details|achievement)\b/i] },
    { key: "reference_full_name", patterns: [/\b(?:reference|referee).*(?:full )?name\b/i] },
    { key: "reference_company", patterns: [/\b(?:reference|referee).*(?:company|organization|employer)\b/i] },
    { key: "reference_email", patterns: [/\b(?:reference|referee).*email\b/i] },
    { key: "reference_phone", patterns: [/\b(?:reference|referee).*(?:phone|mobile|telephone)\b/i] },
    { key: "reference_relationship", patterns: [/\b(?:reference|referee).*(?:relationship|relationship to you)\b/i] },
    { key: "company",    patterns: [/\bcurrent (company|organization|employer)\b/i] },
    { key: "experience", patterns: [/years.*(professional |software |relevant )?(experience|exp)|experience.*years|how many years/i] },
    { key: "summary",    patterns: [/tell.*about (yourself|you)|about (you|yourself)|summary|bio|introduce|why.*hire|motivation|message/i] },
    { key: "skills",     patterns: [/skills|technologies|tech stack|competenc/i] },
    { key: "salary",     patterns: [/salary|compensation|expected pay/i] },
    { key: "education",  patterns: [/education|degree|university|college|school|academic/i] },
    // Radio/Checkbox specific
    { key: "work_authorization", patterns: [/work (authorization|permit|visa)|authorized to work|legally authorized|sponsorship|visa status|right to work/i] },
    { key: "commute_to_office", patterns: [/comfortable\s+(?:with\s+)?commut(?:e|ing).*office|commut(?:e|ing).*office|travel\s+to.*office/i] },
    { key: "willing_to_relocate", patterns: [/willing to relocate|relocation|willing to move/i] },
    { key: "availability",       patterns: [/availability|available to start|start date|when can you start|notice period/i] },
    { key: "onsite_eligible",    patterns: [/able to work (on[- ]?site|in office)|work on[- ]?site|commute to .*office/i] },
    { key: "work_type",          patterns: [/work (type|mode|preference)|preferred.*(remote|on[- ]?site|hybrid)|desired.*(remote|on[- ]?site|hybrid)|full[- ]?time|part[- ]?time|contract/i] },
    { key: "hear_about",         patterns: [/how did you hear|referral|source|where did you find|how did you discover/i] },
    // Common screening questions. These are answered only when the profile has
    // enough information to support the answer; unknown questions are left for
    // the applicant rather than guessing.
    { key: "start_within_4_weeks", patterns: [/start within (the next )?(4|four) weeks|available within (the next )?(4|four) weeks/i] },
    { key: "linux_vps_experience", patterns: [/deployed.*(linux|vps|digitalocean|hetzner)|linux server.*(deploy|debug)|manage.*(linux|vps|server)/i] },
    // File upload specific
    { key: "resume",         patterns: [/resume|cv|curriculum vitae|upload (your )?cv|attach (your )?resume/i] },
    { key: "cover_letter",   patterns: [/cover letter|cover letter upload|attach cover/i] },
    { key: "profile_photo",  patterns: [/profile (photo|picture|image)|upload (your )?photo|headshot|avatar/i] },
    { key: "document",       patterns: [/upload (document|file|attachment)| Supporting document/i] },
  ];

  // ── DOM Walking ──
  function* walkRoots(root = document) {
    yield root;
    const all = root.querySelectorAll?.("*") || [];
    for (const el of all) {
      if (el.shadowRoot) yield* walkRoots(el.shadowRoot);
    }
    const frames = root.querySelectorAll?.("iframe") || [];
    for (const f of frames) {
      try { if (f.contentDocument) yield* walkRoots(f.contentDocument); } catch {}
    }
  }

  function collectFields() {
    const out = [];
    for (const root of walkRoots()) {
      const list = root.querySelectorAll?.(
        "input, textarea, select, [contenteditable='true'], [role='textbox'], [role='combobox']"
      );
      if (list) out.push(...list);
    }
    return out;
  }

  // ── Context Extraction ──
  function getLabelTexts(el) {
    const parts = [];
    try { if (el.labels) for (const l of el.labels) parts.push(l.textContent); } catch {}
    const id = el.id;
    if (id) {
      try {
        const lab = el.ownerDocument.querySelector(`label[for="${CSS.escape(id)}"]`);
        if (lab) parts.push(lab.textContent);
      } catch {}
    }
    const aria = el.getAttribute?.("aria-labelledby");
    if (aria) for (const part of aria.split(/\s+/)) {
      const node = el.ownerDocument.getElementById(part);
      if (node) parts.push(node.textContent);
    }
    return parts;
  }

  function ancestorContext(el, maxHops = 20) {
    const parts = [];
    let p = el.parentElement, hops = 0;
    while (p && hops++ < maxHops) {
      if (p.getAttribute?.("role") === "listitem") {
        const heading = p.querySelector("[role='heading']")?.innerText
          || p.querySelector(".M7eMe, .HoXoMd")?.innerText
          || p.innerText?.split("\n")[0];
        if (heading) parts.push(heading);
        break;
      }
      if (p.tagName === "LABEL") parts.push(p.textContent);
      const lab = ["FORM", "BODY", "HTML"].includes(p.tagName)
        ? null
        : Array.from(p.children || []).find((child) => child.matches?.("label, [role='heading'], legend"));
      if (lab && lab !== el) parts.push(lab.innerText || lab.textContent);
      p = p.parentElement;
    }
    return parts;
  }

  function buildContext(el) {
    const attrs = [
      el.name, el.id, el.placeholder, el.type,
      el.getAttribute?.("aria-label"),
      el.getAttribute?.("autocomplete"),
      el.getAttribute?.("data-qa"),
      el.getAttribute?.("data-testid"),
      el.getAttribute?.("data-automation-id"),
      el.getAttribute?.("data-field"),
      el.getAttribute?.("title"),
    ].filter(Boolean);
    const labelTexts = getLabelTexts(el);
    const ancestors = ancestorContext(el);
    const text = [...attrs, ...labelTexts, ...ancestors].join(" | ").toLowerCase().replace(/\s+/g, " ");
    return { text, attrs, labelTexts, ancestors };
  }

  // ── Classification ──
  function classify(el) {
    const type = (el.type || "").toLowerCase();
    const ac = (el.getAttribute?.("autocomplete") || "").toLowerCase();
    if (type === "email" || ac === "email") return { key: "email", confidence: 0.99, reason: "type/autocomplete" };
    if (type === "tel" || ac.startsWith("tel")) return { key: "phone", confidence: 0.97, reason: "type/autocomplete" };
    if (ac === "given-name") return { key: "first_name", confidence: 0.97, reason: "autocomplete" };
    if (ac === "family-name") return { key: "last_name", confidence: 0.97, reason: "autocomplete" };
    if (ac === "name") return { key: "full_name", confidence: 0.95, reason: "autocomplete" };
    if (ac === "url") return { key: "portfolio", confidence: 0.7, reason: "autocomplete=url" };

    const ctx = buildContext(el);
    if (!ctx.text) return { key: null, confidence: 0, reason: "no context" };

    // Upload fields frequently contain the word "resume" or "cover letter",
    // which can otherwise be mistaken for a free-text summary field.
    if (type === "file") {
      for (const sem of SEMANTICS.filter((item) => ["resume", "cover_letter", "profile_photo", "document"].includes(item.key))) {
        if (sem.patterns.some((re) => re.test(ctx.text))) {
          return { key: sem.key, confidence: 0.99, reason: "file upload label" };
        }
      }
      return { key: "document", confidence: 0.6, reason: "generic file upload" };
    }

    let best = { key: null, confidence: 0, reason: "no match" };
    for (const sem of SEMANTICS) {
      let hit = 0, base = 0;
      for (const re of sem.patterns) if (re.test(ctx.text)) { hit++; base = Math.max(base, 0.85); }
      if (!hit) continue;
      const inLabel = sem.patterns.some(re => ctx.labelTexts.concat(ctx.ancestors).some(t => re.test(String(t))));
      const conf = Math.min(0.99, base + (inLabel ? 0.1 : 0) + (hit > 1 ? 0.03 : 0));
      if (conf > best.confidence) best = { key: sem.key, confidence: conf, reason: `regex:${sem.key}` };
    }
    // Employer-specific dropdowns and yes/no controls do not have a universal
    // field name. Preserve their question context so a user-saved answer can
    // match them exactly (for example, a Linux deployment question).
    if (!best.key && (el.tagName === "SELECT" || ["radio", "checkbox"].includes(type))) {
      return { key: "custom_screening_answer", confidence: 0.6, reason: "screening question" };
    }
    return best;
  }

  // ── Fill Helpers ──
  function isVisible(el) {
    if (!el || !el.ownerDocument) return false;
    const cs = el.ownerDocument.defaultView?.getComputedStyle?.(el);
    if (cs && (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0")) return false;
    const rect = el.getBoundingClientRect?.();
    if (rect && rect.width === 0 && rect.height === 0) return false;
    return true;
  }

  function isFillable(el) {
    if (!el || !el.tagName) return false;
    if (el.disabled || el.readOnly) return false;
    const t = (el.type || "").toLowerCase();
    // Most job sites hide the real file input behind an Upload button. It is
    // still safe and necessary to populate that input programmatically.
    if (t !== "file" && !isVisible(el)) return false;
    // File inputs handled separately, skip hidden/submit/button/image/reset
    if (["hidden", "submit", "button", "image", "reset"].includes(t)) return false;
    return true;
  }

  function nativeSet(el, value) {
    const tag = el.tagName;
    const proto =
      tag === "TEXTAREA" ? HTMLTextAreaElement.prototype :
      tag === "SELECT"   ? HTMLSelectElement.prototype   :
                           HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    try { setter ? setter.call(el, value) : (el.value = value); } catch { try { el.value = value; } catch {} }
  }

  function fireEvents(el) {
    const win = el.ownerDocument?.defaultView || window;
    const opts = { bubbles: true, cancelable: true };
    el.dispatchEvent(new win.Event("focus", opts));
    const inputEvent = win.InputEvent
      ? new win.InputEvent("input", { ...opts, inputType: "insertText", data: el.value })
      : new win.Event("input", opts);
    el.dispatchEvent(inputEvent);
    el.dispatchEvent(new win.Event("change", opts));
    el.dispatchEvent(new win.KeyboardEvent("keydown", { ...opts, key: "Tab" }));
    el.dispatchEvent(new win.KeyboardEvent("keyup", { ...opts, key: "Tab" }));
    el.dispatchEvent(new win.Event("blur", opts));
  }

  async function humanType(el, value) {
    el.focus?.();
    nativeSet(el, "");
    fireEvents(el);
    const chunkSize = Math.max(1, Math.ceil(value.length / 6));
    let typed = "";
    for (let i = 0; i < value.length; i += chunkSize) {
      typed += value.slice(i, i + chunkSize);
      nativeSet(el, typed);
      fireEvents(el);
      await new Promise(r => setTimeout(r, 25));
    }
    nativeSet(el, value);
    fireEvents(el);
  }

  function fillContentEditable(el, value) {
    el.focus?.();
    try {
      el.innerText = value;
      el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    } catch {}
  }

  function fillSelect(el, value) {
    if (!value) return false;
    const v = String(value).trim().toLowerCase();
    let match = null;
    for (const opt of el.options) {
      const ov = (opt.value || "").toLowerCase();
      const ot = (opt.textContent || "").toLowerCase();
      if (ov === v || ot === v) { match = opt; break; }
      if (!match && (ov.includes(v) || ot.includes(v))) match = opt;
    }
    // A select often uses human labels such as "Yes, I can" for a profile value
    // of "yes". Match these predictable boolean labels without choosing an
    // unrelated option.
    if (!match && ["yes", "no"].includes(v)) {
      match = Array.from(el.options).find((opt) => {
        const optionText = `${opt.value || ""} ${opt.textContent || ""}`.trim().toLowerCase();
        return v === "yes" ? /^(yes|true|1)\b/.test(optionText) : /^(no|false|0)\b/.test(optionText);
      }) || null;
    }
    if (!match) return false;
    nativeSet(el, match.value);
    fireEvents(el);
    return true;
  }

  // ── Radio Button Fill ──
  function fillRadio(el, value) {
    if (!value) return false;
    const v = String(value).trim().toLowerCase();
    const name = el.name;
    if (!name) return false;

    // Get all radios in the same group
    const doc = el.ownerDocument || document;
    const radios = doc.querySelectorAll(`input[type="radio"][name="${CSS.escape(name)}"]`);

    for (const radio of radios) {
      const radioVal = (radio.value || "").toLowerCase();
      const radioLabel = getLabelTexts(radio).join(" ").toLowerCase();
      const siblingText = radio.parentElement?.textContent?.toLowerCase() || "";

      // Exact match on value
      if (radioVal === v) { clickRadio(radio); return true; }
      // Match on label text
      if (radioLabel && radioLabel.includes(v)) { clickRadio(radio); return true; }
      // Match on sibling text
      if (siblingText.includes(v)) { clickRadio(radio); return true; }
      // Partial match
      if (v.includes(radioVal) && radioVal.length > 1) { clickRadio(radio); return true; }
    }

    // For yes/no questions, try matching "yes" / "true" / "1"
    if (["yes", "true", "1", "y"].includes(v)) {
      for (const radio of radios) {
        const rv = (radio.value || "").toLowerCase();
        const rl = getLabelTexts(radio).join(" ").toLowerCase();
        if (["yes", "true", "1", "y"].some(y => rv.includes(y) || rl.includes(y))) {
          clickRadio(radio); return true;
        }
      }
    }

    return false;
  }

  function clickRadio(el) {
    el.focus?.();
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "checked")?.set;
    try { setter ? setter.call(el, true) : (el.checked = true); } catch { el.checked = true; }
    el.dispatchEvent(new Event("focus", { bubbles: true }));
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  }

  // ── Checkbox Fill ──
  function fillCheckbox(el, value) {
    const v = String(value).trim().toLowerCase();

    // Boolean check: if value is truthy, check the box; if falsy, uncheck
    if (["yes", "true", "1", "y", "on"].includes(v)) {
      if (!el.checked) { clickCheckbox(el, true); }
      return true;
    }
    if (["no", "false", "0", "n", "off", ""].includes(v)) {
      if (el.checked) { clickCheckbox(el, false); }
      return true;
    }

    // Multi-value: check if this checkbox's value is in the list
    const cbVal = (el.value || "").toLowerCase();
    const cbLabel = getLabelTexts(el).join(" ").toLowerCase();
    const siblingText = el.parentElement?.textContent?.toLowerCase() || "";

    // Value is a comma-separated list of things to check
    const values = v.split(",").map(s => s.trim());

    for (const val of values) {
      if (cbVal === val) { if (!el.checked) clickCheckbox(el, true); return true; }
      if (cbLabel && cbLabel.includes(val)) { if (!el.checked) clickCheckbox(el, true); return true; }
      if (siblingText.includes(val)) { if (!el.checked) clickCheckbox(el, true); return true; }
    }

    return false;
  }

  function clickCheckbox(el, checked) {
    el.focus?.();
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "checked")?.set;
    try { setter ? setter.call(el, checked) : (el.checked = checked); } catch { el.checked = checked; }
    el.dispatchEvent(new Event("focus", { bubbles: true }));
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  }

  // ── File Upload Fill ──
  // Generated from .env at build time so the extension cannot silently use
  // a stale Supabase project after the application moves environments.
  let storageConfigPromise = null;
  async function getStorageConfig() {
    if (!storageConfigPromise) {
      storageConfigPromise = fetch(chrome.runtime.getURL("config.local.json"))
        .then((response) => {
          if (!response.ok) throw new Error("Extension connection is not configured.");
          return response.json();
        })
        .then((config) => {
          if (!config?.supabaseUrl || !config?.anonKey) throw new Error("Extension connection is incomplete.");
          return config;
        });
    }
    return storageConfigPromise;
  }

  async function fillFileInput(el, profile, key) {
    const session = await chrome.storage.local.get("session").then(r => r.session);
    if (!session) return false;

    let filePath = null;
    let fileName = "document";
    let bucket = "resumes";

    switch (key) {
      case "resume":
        filePath = profile.resume_url;
        fileName = "resume.pdf";
        break;
      case "cover_letter":
        filePath = profile.cover_letter_url;
        fileName = "cover_letter.pdf";
        break;
      case "profile_photo":
        filePath = profile.avatar_url || profile.profile_picture_url;
        fileName = "profile_photo.jpg";
        bucket = "profile-assets";
        break;
      case "document":
        filePath = profile.document_url;
        fileName = "document.pdf";
        break;
      default:
        return false;
    }

    if (!filePath) return false;
    const normalizedFilePath = String(filePath).replace(/\\/g, "/").replace(/^\/+/, "");
    if (!normalizedFilePath.startsWith(`${session.user.id}/`)) return false;

    try {
      const { supabaseUrl, anonKey } = await getStorageConfig();
      // Fetch file from Supabase storage
      const fileUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${normalizedFilePath}`;
      const res = await fetch(fileUrl, {
        headers: { "Authorization": `Bearer ${session.access_token}`, "apikey": anonKey }
      });
      if (!res.ok) return false;

      const blob = await res.blob();
      const storedFileName = decodeURIComponent(normalizedFilePath.split("/").pop() || "")
        .replace(/^\d+_/, "")
        .replace(/[^a-zA-Z0-9._-]+/g, "_");
      if (/\.(pdf|docx|doc|jpg|jpeg|png)$/i.test(storedFileName)) {
        fileName = storedFileName;
      }
      const file = new File([blob], fileName, { type: blob.type || "application/pdf" });

      // Create DataTransfer to set file input
      const dt = new DataTransfer();
      dt.items.add(file);
      el.files = dt.files;

      // Fire events
      el.dispatchEvent(new Event("focus", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("blur", { bubbles: true }));

      return true;
    } catch (e) {
      WARN("File fill failed:", e);
      return false;
    }
  }

  // ── Value Resolution ──
  // Profile facts are structured. The extension never reuses arbitrary
  // employer-specific questions and answers across separate applications.
  function valueText(value) {
    if (value === null || value === undefined) return "";
    if (value === true) return "yes";
    if (value === false) return "no";
    if (Array.isArray(value)) return value.map(valueText).filter(Boolean).join(", ");
    return String(value).trim();
  }

  async function downloadSavedResume(profile) {
    const filePath = String(profile?.resume_url || "").replace(/\\/g, "/").replace(/^\/+/, "");
    const session = await chrome.storage.local.get("session").then((result) => result.session);
    if (!session || !filePath || !filePath.startsWith(`${session.user.id}/`)) {
      throw new Error("Upload a resume in the JobAI extension first.");
    }
    const { supabaseUrl, anonKey } = await getStorageConfig();
    const response = await fetch(`${supabaseUrl}/storage/v1/object/resumes/${filePath}`, {
      headers: { Authorization: `Bearer ${session.access_token}`, apikey: anonKey },
    });
    if (!response.ok) throw new Error("Could not prepare your saved resume.");
    const blob = await response.blob();
    const storedName = decodeURIComponent(filePath.split("/").pop() || "JobAI_resume.pdf")
      .replace(/^\d+_/, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "_");
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = /\.(pdf|docx)$/i.test(storedName) ? storedName : "JobAI_resume.pdf";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }

  function careerData(profile) {
    const raw = profile?.career_profile;
    if (!raw) return {};
    if (typeof raw === "string") {
      try { return JSON.parse(raw) || {}; } catch { return {}; }
    }
    return typeof raw === "object" ? raw : {};
  }

  function listFromCareer(profile, name) {
    const value = careerData(profile)[name];
    return Array.isArray(value) ? value : [];
  }

  function currentExperience(profile) {
    const entries = listFromCareer(profile, "experiences");
    return entries.find((entry) => entry?.isCurrent || entry?.is_current) || entries[0] || {};
  }

  function educationSummaryFacts(profile) {
    const summary = valueText(profile?.education);
    if (!summary) return { institution: "", endDate: "" };
    const segments = summary.split(/[\n,;|]/).map((part) => part.trim()).filter(Boolean);
    const institution = segments.find((part) => /university|college|institute|school/i.test(part)) || "";
    const years = [...summary.matchAll(/\b(?:19|20)\d{2}\b/g)].map((match) => match[0]);
    return { institution, endDate: years.at(-1) || "" };
  }

  function dateForField(value, fieldType) {
    const text = valueText(value);
    if (fieldType === "date" && /^\d{4}$/.test(text)) return `${text}-01-01`;
    if (fieldType === "date" && /^\d{4}-\d{2}$/.test(text)) return `${text}-01`;
    if (fieldType === "month" && /^\d{4}$/.test(text)) return `${text}-01`;
    return text;
  }

  function resolveStructuredValue(profile, key, index, fieldType) {
    const experience = listFromCareer(profile, "experiences")[index] || {};
    const education = listFromCareer(profile, "education")[index] || {};
    const project = listFromCareer(profile, "projects")[index] || {};
    const reference = listFromCareer(profile, "references")[index] || {};
    const achievements = listFromCareer(profile, "achievements");
    const values = {
      experience_title: experience.title,
      experience_company: experience.company,
      experience_start_date: dateForField(experience.startDate || experience.start_date, fieldType),
      experience_end_date: experience.isCurrent || experience.is_current ? "" : dateForField(experience.endDate || experience.end_date, fieldType),
      experience_description: valueText([experience.summary, ...(Array.isArray(experience.highlights) ? experience.highlights : [])]),
      education_institution: education.institution || education.school,
      education_degree: education.degree,
      education_field: education.fieldOfStudy || education.field_of_study,
      education_start_date: dateForField(education.startDate || education.start_date, fieldType),
      education_end_date: dateForField(education.endDate || education.end_date, fieldType),
      project_name: project.name,
      project_role: project.role,
      project_url: project.url,
      project_description: valueText([project.description, ...(Array.isArray(project.highlights) ? project.highlights : [])]),
      reference_full_name: reference.permissionToContact || reference.permission_to_contact ? (reference.fullName || reference.full_name || reference.name) : "",
      reference_company: reference.permissionToContact || reference.permission_to_contact ? reference.company : "",
      reference_email: reference.permissionToContact || reference.permission_to_contact ? reference.email : "",
      reference_phone: reference.permissionToContact || reference.permission_to_contact ? reference.phone : "",
      reference_relationship: reference.permissionToContact || reference.permission_to_contact ? reference.relationship : "",
      certification: achievements.filter((item) => (item.type || "certification") === "certification").map((item) => item.title),
    };
    return valueText(values[key]);
  }

  function evidenceFor(profile, key) {
    if (["onsite_eligible", "start_within_4_weeks", "linux_vps_experience"].includes(key)) {
      return { source: "profile_inference" };
    }
    if (profile?.data_sources?.[key] === "ai") return { source: "ai_suggestion" };
    return { source: "verified_profile" };
  }

  function resolveValue(profile, key, contextText = "", index = 0, fieldType = "") {
    const structured = resolveStructuredValue(profile, key, index, fieldType);
    if (structured) return { value: structured, evidence: evidenceFor(profile, "career_profile") };

    if (key === "commute_to_office") {
      const explicit = valueText(profile.commute_to_office ?? profile.onsite_eligible);
      if (explicit) return { value: explicit, evidence: { source: "verified_profile" } };
      const inferred = resolveOnsiteEligibility(profile, contextText);
      const requestedPlace = String(contextText).match(/office\s+(?:in|at)\s+([a-z][a-z .'-]{2,}?)(?=[?*|]|$)/i)?.[1]?.trim();
      const locationMatch = Boolean(requestedPlace && profile.location && String(profile.location).toLowerCase().includes(requestedPlace.toLowerCase()));
      return {
        value: inferred,
        evidence: locationMatch ? { source: "verified_profile" } : { source: "profile_inference" },
      };
    }

    const skills = Array.isArray(profile.skills) ? profile.skills.join(", ") : (profile.skills || "");
    const [first = "", ...rest] = valueText(profile.full_name).split(/\s+/);
    const latestExperience = currentExperience(profile);
    const educationFacts = educationSummaryFacts(profile);
    const map = {
      email: valueText(profile.email),
      phone: valueText(profile.phone),
      first_name: first,
      last_name: rest.join(" "),
      full_name: valueText(profile.full_name),
      linkedin: valueText(profile.linkedin_url),
      github: valueText(profile.github_url),
      portfolio: valueText(profile.portfolio_url) || valueText(profile.linkedin_url) || valueText(profile.github_url),
      location: valueText(profile.location),
      company: valueText(profile.current_company || latestExperience.company),
      experience: profile.experience_years === 0 ? "0" : valueText(profile.experience_years),
      summary: valueText(profile.cv_summary || profile.bio),
      skills: valueText(skills),
      salary: valueText(profile.expected_salary),
      education: valueText(profile.education),
      education_institution: valueText(educationFacts.institution),
      education_end_date: dateForField(educationFacts.endDate, fieldType),
      work_authorization: valueText(profile.work_authorization),
      willing_to_relocate: valueText(profile.willing_to_relocate),
      availability: valueText(profile.availability),
      work_type: valueText(profile.work_type || profile.job_type),
      onsite_eligible: resolveOnsiteEligibility(profile, contextText),
      start_within_4_weeks: resolveStartAvailability(profile),
      linux_vps_experience: resolveLinuxVpsExperience(profile),
      resume: valueText(profile.resume_url),
      // A cover letter is job-specific and is never substituted with a CV
      // summary or uploaded without an explicit applicant action.
      cover_letter: "",
      profile_photo: valueText(profile.avatar_url || profile.profile_picture_url),
      document: "",
    };
    return { value: map[key] || "", evidence: evidenceFor(profile, key) };
  }

  function resolveOnsiteEligibility(profile, contextText = "") {
    const preference = String(profile.work_type || profile.job_type || "").toLowerCase();
    // Do not claim onsite availability for a remote-only preference.
    if (/remote/.test(preference) && !/hybrid|on.?site/.test(preference)) return "no";
    if (!/on.?site|hybrid/.test(preference)) return "";
    // If the question names a city, only answer yes when it matches the saved
    // location. This avoids making a claim about a different city.
    const cityMatches = [...String(contextText).matchAll(/(?:on[- ]?site|in office|office\s+(?:in|at))\s+(?:in\s+)?([a-z][a-z .'-]{2,}?)(?=[?*|]|$)/ig)];
    const city = cityMatches.at(-1)?.[1]?.trim();
    if (city && profile.location && !String(profile.location).toLowerCase().includes(city.toLowerCase())) return "";
    return "yes";
  }

  function resolveStartAvailability(profile) {
    const availability = String(profile.availability || "").toLowerCase();
    return /immediate|asap|now|2 weeks?|two weeks?|3 weeks?|three weeks?|4 weeks?|four weeks?/.test(availability) ? "yes" : "";
  }

  function resolveLinuxVpsExperience(profile) {
    const evidence = [profile.skills, profile.cv_summary, profile.bio, profile.experience_details]
      .flatMap((value) => Array.isArray(value) ? value : [value])
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return /linux|digitalocean|hetzner|vps|ubuntu|nginx|docker|server deployment/.test(evidence) ? "yes" : "";
  }

  // ── Main Fill Pass ──
  const MIN_CONFIDENCE = 0.4;
  const FILE_TYPES = ["resume", "cover_letter", "profile_photo", "document"];
  const decisionEngine = globalThis.JobAIFormDecisionEngine;
  let fillPassInFlight = false;
  let activeFillPromise = null;

  function normalizedPreferences(profile) {
    const raw = profile?.autofill_preferences || {};
    const toRange = (value, fallback) => {
      const number = Number(value);
      return Number.isFinite(number) && number >= 0 && number <= 1 ? number : fallback;
    };
    return {
      textAutofillConfidence: Math.max(0.75, toRange(raw.textAutofillConfidence ?? raw.text_autofill_confidence, 0.75)),
      checkboxConfidence: Math.max(0.41, toRange(raw.checkboxConfidence ?? raw.checkbox_confidence, 0.41)),
    };
  }

  function semanticLabel(key) {
    return String(key || "field").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function inferStructuredKey(contextText) {
    const text = String(contextText || "").toLowerCase();
    const has = (pattern) => pattern.test(text);
    const inExperience = has(/work experience|employment history|professional experience|previous employment/);
    const inEducation = has(/education history|academic history|education details|degree information/);
    const inProject = has(/project experience|project details|portfolio project/);
    const inReference = has(/reference|referee/);
    if (inExperience) {
      if (has(/(?:job|position|role) title|^title\b/)) return "experience_title";
      if (has(/company|employer|organization/)) return "experience_company";
      if (has(/start|from/)) return "experience_start_date";
      if (has(/end|to date/)) return "experience_end_date";
      if (has(/description|responsibilit|achievement|duties/)) return "experience_description";
    }
    if (inEducation) {
      if (has(/school|college|university|institution/)) return "education_institution";
      if (has(/degree|qualification/)) return "education_degree";
      if (has(/field of study|major|speciali[sz]ation/)) return "education_field";
      if (has(/start|from/)) return "education_start_date";
      if (has(/end|graduation|to date/)) return "education_end_date";
    }
    if (inProject) {
      if (has(/project name|^name\b/)) return "project_name";
      if (has(/role|position/)) return "project_role";
      if (has(/url|link|website|repository|demo/)) return "project_url";
      if (has(/description|summary|details|achievement/)) return "project_description";
    }
    if (inReference) {
      if (has(/email/)) return "reference_email";
      if (has(/phone|mobile|telephone/)) return "reference_phone";
      if (has(/company|organization|employer/)) return "reference_company";
      if (has(/relationship/)) return "reference_relationship";
      if (has(/name/)) return "reference_full_name";
    }
    return null;
  }

  function inferSafeNameKey(contextText) {
    const text = String(contextText || "").toLowerCase();
    if (!/\bname\b/.test(text)) return null;
    if (/company|organization|university|college|school|reference|referee|project|file name|document/.test(text)) return null;
    return "full_name";
  }

  function decisionForField({ el, key, context, confidence, value, evidence }) {
    if (!decisionEngine) return { action: "manual", canFill: false, reason: "safety-engine-unavailable" };
    return decisionEngine.decide({
      field: {
        key,
        context: context.text,
        type: (el.type || "").toLowerCase(),
        tagName: el.tagName,
        isContentEditable: el.getAttribute?.("contenteditable") === "true",
      },
      value,
      confidence,
      evidence,
    });
  }

  function addOutcome(outcomes, key, item) {
    if (!key) return;
    if (!outcomes.some((entry) => entry.key === key && entry.reason === item.reason)) {
      outcomes.push({ key, label: semanticLabel(key), ...item });
    }
  }

  function findGoogleFilePicker() {
    if (!/docs\.google\.com\/forms/i.test(location.href)) return null;
    return Array.from(document.querySelectorAll("button, [role='button']")).find((element) => {
      const context = `${element.textContent || ""} ${ancestorContext(element, 8).join(" ")}`.toLowerCase();
      return /add file|upload.*(?:resume|cv)|resume.*upload/.test(context);
    }) || null;
  }

  function hasManualResumePicker() {
    return Boolean(findGoogleFilePicker());
  }

  async function fillForm(profile) {
    if (fillPassInFlight) return { count: 0, fields: [], missing: [], suggestions: [], protected: [], reviewed: [] };
    fillPassInFlight = true;
    const fields = collectFields();
    LOG(`Scanning ${fields.length} candidate field(s)`);
    let count = 0;
    const filledKeys = new Set();
    const missingKeys = new Set();
    const suggestions = [];
    const protectedFields = [];
    const reviewed = [];
    const preferences = normalizedPreferences(profile);
    const structuredIndexes = new Map();

    // Track radio groups we've already processed
    const processedRadioGroups = new Set();

    for (const el of fields) {
      if (!isFillable(el)) continue;

      const type = (el.type || "").toLowerCase();
      const isCE = el.getAttribute?.("contenteditable") === "true";
      const isRadio = type === "radio";
      const isCheckbox = type === "checkbox";
      const isFile = type === "file";

      // Skip already-filled text inputs
      if (!isRadio && !isCheckbox && !isFile) {
        const currentVal = isCE ? el.innerText : el.value;
        if (currentVal && String(currentVal).trim().length > 0) continue;
      }

      // Skip an already-selected radio group altogether. Otherwise the next
      // unselected option in that group would cause a needless re-fill pass.
      if (isRadio && el.checked) {
        processedRadioGroups.add(`${el.name}`);
        continue;
      }
      if (isCheckbox && el.checked) continue;
      if (isFile && el.files?.length) continue;

      const classified = classify(el);
      const context = buildContext(el);
      const structuredKey = inferStructuredKey(context.text);
      const inferredName = !classified.key ? inferSafeNameKey(context.text) : null;
      const key = structuredKey || classified.key || inferredName;
      const confidence = structuredKey
        ? Math.max(classified.confidence, 0.9)
        : (inferredName ? Math.max(classified.confidence, 0.78) : classified.confidence);
      const reason = classified.reason;

      // Terms, consent, diversity, verification and final-submit controls
      // are still surfaced even if semantic matching cannot name the field.
      if (!key) {
        const manual = decisionForField({ el, key: "", context, confidence: 0, value: null, evidence: null });
        if (manual.action === "manual") addOutcome(protectedFields, "manual_review", { reason: manual.reason });
        continue;
      }
      if (confidence < MIN_CONFIDENCE) continue;

      // Skip duplicate radio groups
      if (isRadio) {
        const groupKey = `${el.name}`;
        if (processedRadioGroups.has(groupKey)) continue;
        processedRadioGroups.add(groupKey);
      }

      const isStructured = /^(experience|education|project|reference)_/.test(key);
      const index = isStructured ? (structuredIndexes.get(key) || 0) : 0;
      if (isStructured) structuredIndexes.set(key, index + 1);
      const resolved = resolveValue(profile, key, context.text, index, type);
      const value = resolved.value;

      // Handle file inputs separately
      if (isFile || FILE_TYPES.includes(key)) {
        if (!isFile) continue; // Only handle actual file inputs
        if (!["resume", "profile_photo"].includes(key)) {
          addOutcome(suggestions, key, { reason: key === "cover_letter" ? "tailored-cover-letter-required" : "manual-document-upload" });
          continue;
        }
        if (!value) { missingKeys.add(key); continue; }
        if (confidence < 0.9) {
          addOutcome(suggestions, key, { reason: `${key}-field-needs-review` });
          continue;
        }
        try {
          if (await fillFileInput(el, profile, key)) {
            count++;
            filledKeys.add(key);
            LOG(`Filled file: ${key}`);
          }
        } catch (e) { WARN("File fill failed:", e); }
        continue;
      }

      const decision = decisionForField({ el, key, context, confidence, value, evidence: resolved.evidence });
      if (decision.action === "manual") {
        addOutcome(protectedFields, key, { reason: decision.reason });
        continue;
      }
      if (!value) { missingKeys.add(key); continue; }

      const threshold = isRadio || isCheckbox
        ? Math.max(0.9, preferences.checkboxConfidence)
        : preferences.textAutofillConfidence;
      if (confidence < threshold || decision.action === "suggest" || !decision.canFill) {
        addOutcome(suggestions, key, { reason: decision.reason || "review-suggestion" });
        continue;
      }

      try {
        if (isRadio) {
          if (fillRadio(el, value)) { count++; filledKeys.add(key); LOG(`Filled radio: ${key} = ${value}`); }
          else { missingKeys.add(key); }
        } else if (isCheckbox) {
          if (fillCheckbox(el, value)) { count++; filledKeys.add(key); LOG(`Filled checkbox: ${key} = ${value}`); }
          else { missingKeys.add(key); }
        } else if (el.tagName === "SELECT") {
          if (fillSelect(el, value)) { count++; filledKeys.add(key); }
        } else if (isCE) {
          fillContentEditable(el, value);
          count++; filledKeys.add(key);
        } else {
          await humanType(el, value);
          count++; filledKeys.add(key);
        }
        if (decision.action === "fill_with_review") addOutcome(reviewed, key, { reason: decision.reason });
        LOG(`Filled: ${key} (${Math.round(confidence * 100)}%) [${reason}]`);
      } catch (e) { WARN("fill failed", e, el); }
    }

    if (hasManualResumePicker()) {
      addOutcome(suggestions, "resume", { reason: "google-file-picker-required" });
    }

    LOG(`Done — filled ${count} field(s)`);
    fillPassInFlight = false;
    return {
      count,
      fields: [...filledKeys],
      missing: [...missingKeys].filter((key) => !filledKeys.has(key)),
      suggestions,
      protected: protectedFields,
      reviewed,
    };
  }

  async function runFillWithRetry(profile, totalMs = 5000, intervalMs = 600) {
    const seen = new Set();
    const missing = new Set();
    const suggestions = [];
    const protectedFields = [];
    const reviewed = [];
    const start = Date.now();
    while (Date.now() - start < totalMs) {
      const r = await fillForm(profile);
      for (const f of r.fields) seen.add(f);
      for (const f of r.missing || []) missing.add(f);
      for (const item of r.suggestions || []) addOutcome(suggestions, item.key, item);
      for (const item of r.protected || []) addOutcome(protectedFields, item.key, item);
      for (const item of r.reviewed || []) addOutcome(reviewed, item.key, item);
      await new Promise(r => setTimeout(r, intervalMs));
    }
    return {
      count: seen.size,
      fields: [...seen],
      missing: [...missing].filter((key) => !seen.has(key)),
      suggestions,
      protected: protectedFields,
      reviewed,
    };
  }

  function fillWithRetry(profile, totalMs = 5000, intervalMs = 600) {
    if (activeFillPromise) return activeFillPromise;
    activeFillPromise = runFillWithRetry(profile, totalMs, intervalMs)
      .finally(() => { activeFillPromise = null; });
    return activeFillPromise;
  }

  let watcher = null;
  function watchDynamic(profile, durationMs = 10000) {
    if (watcher) { try { watcher.disconnect(); } catch {} watcher = null; }
    const stopAt = Date.now() + durationMs;
    let scheduled = false;
    const flush = async () => { scheduled = false; await fillForm(profile); };
    watcher = new MutationObserver((muts) => {
      if (Date.now() > stopAt) { try { watcher.disconnect(); } catch {} watcher = null; return; }
      for (const m of muts) if (m.addedNodes && m.addedNodes.length) {
        if (!scheduled) { scheduled = true; setTimeout(flush, 350); }
        return;
      }
    });
    watcher.observe(document.documentElement, { childList: true, subtree: true });
  }

  // ── Side Panel ──
  let panelHost = null;
  let highlightedEls = [];

  function clearHighlights() {
    for (const el of highlightedEls) {
      try { el.style.outline = ""; el.style.outlineOffset = ""; } catch {}
    }
    highlightedEls = [];
  }

  function highlightMissingFields(missingKeys) {
    clearHighlights();
    const fields = collectFields();
    for (const el of fields) {
      if (!isFillable(el)) continue;
      const isCE = el.getAttribute?.("contenteditable") === "true";
      const currentVal = isCE ? el.innerText : el.value;
      if (currentVal && String(currentVal).trim().length > 0) continue;
      const { key, confidence } = classify(el);
      if (key && confidence >= MIN_CONFIDENCE && missingKeys.includes(key)) {
        try {
          el.style.outline = "2px dashed #ef4444";
          el.style.outlineOffset = "2px";
          highlightedEls.push(el);
        } catch {}
      }
    }
  }

  function removePanel() {
    if (panelHost) { try { panelHost.remove(); } catch {} panelHost = null; }
    clearHighlights();
  }

  function escapePanelText(value) {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
  }

  function humanReason(reason) {
    const text = String(reason || "");
    if (/manual-legal/.test(text)) return "Terms, consent, or a declaration — you must decide.";
    if (/manual-sensitive/.test(text)) return "Personal or diversity information — intentionally left to you.";
    if (/manual-protected/.test(text)) return "Verification, assessment, or final submission — never automated.";
    if (/tailored-cover-letter/.test(text)) return "Create a tailored letter for this job before adding it.";
    if (/missing-value/.test(text)) return "Add this fact to your Career Passport first.";
    if (/direct-evidence/.test(text)) return "A saved fact needs your review before it can be used.";
    if (/confidence/.test(text) || /review/.test(text) || /suggest/.test(text)) return "Suggestion only — review it before using it.";
    if (/document-upload/.test(text)) return "Choose this document yourself.";
    if (/google-file-picker/.test(text)) return "Google requires you to choose the resume in its signed-in file picker.";
    return "Needs your review.";
  }

  function outcomeList(items, emptyText, tone) {
    if (!items?.length) return `<p class="empty">${escapePanelText(emptyText)}</p>`;
    return `<ul class="outcomes ${tone}">${items.map((item) => `<li><strong>${escapePanelText(item.label || semanticLabel(item.key))}</strong><span>${escapePanelText(humanReason(item.reason))}</span></li>`).join("")}</ul>`;
  }

  function createSidePanel(fillResult, profile = {}) {
    removePanel();
    const missing = fillResult?.missing || [];
    const suggestions = fillResult?.suggestions || [];
    const protectedFields = fillResult?.protected || [];
    const reviewed = fillResult?.reviewed || [];
    const googlePickerRequired = suggestions.some((item) => item?.reason === "google-file-picker-required");
    highlightMissingFields(missing);

    panelHost = document.createElement("div");
    panelHost.id = "jobai-side-panel-host";
    panelHost.style.cssText = "position:fixed;top:0;right:0;z-index:2147483647;pointer-events:none;";
    document.documentElement.appendChild(panelHost);
    const shadow = panelHost.attachShadow({ mode: "closed" });
    shadow.innerHTML = `
      <style>
        :host { pointer-events:auto; }
        .panel { position:fixed; top:16px; right:16px; width:min(360px,calc(100vw - 32px)); max-height:calc(100vh - 32px); overflow:auto; box-sizing:border-box; color:#edf2ff; background:linear-gradient(160deg,#111936 0%,#0b1125 58%,#14103b 100%); border:1px solid rgba(139,92,246,.36); border-radius:18px; box-shadow:0 26px 70px rgba(2,6,23,.52); font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; animation:jobai-review-enter .24s ease-out; }
        @keyframes jobai-review-enter { from { transform:translateY(-10px);opacity:0 } to { transform:translateY(0);opacity:1 } }
        .header { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; padding:18px 18px 14px; border-bottom:1px solid rgba(148,163,184,.16); }
        .eyebrow { color:#a5b4fc; font-size:10px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; margin:0 0 5px; } h3 { margin:0; font-size:16px; letter-spacing:-.02em; } .close { appearance:none;border:0;background:rgba(148,163,184,.12);color:#e2e8f0;width:28px;height:28px;border-radius:9px;font-size:19px;cursor:pointer; } .close:hover,.close:focus-visible { background:rgba(139,92,246,.28);outline:2px solid #a78bfa;outline-offset:2px; }
        .summary { padding:14px 18px 4px; font-size:12px; line-height:1.5; color:#cbd5e1; } .stats { display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:12px 18px 4px; } .stat { border:1px solid rgba(148,163,184,.16);border-radius:12px;padding:9px 7px;background:rgba(15,23,42,.44);text-align:center; } .stat strong { display:block;font-size:18px; } .stat span { display:block;margin-top:2px;font-size:10px;color:#aab8d5; }
        .body { padding:8px 18px 18px; } .group { margin-top:13px; } .group h4 { margin:0 0 7px;color:#dbeafe;font-size:11px;letter-spacing:.08em;text-transform:uppercase; } .outcomes { margin:0;padding:0;list-style:none;display:grid;gap:6px; } .outcomes li { padding:9px 10px;border-radius:10px;border:1px solid rgba(148,163,184,.13);background:rgba(15,23,42,.38); } .outcomes li strong { display:block;font-size:12px; } .outcomes li span { display:block;margin-top:3px;color:#aab8d5;font-size:11px;line-height:1.35; } .outcomes.warn li { border-color:rgba(245,158,11,.25); } .outcomes.manual li { border-color:rgba(244,114,182,.28); } .empty { color:#94a3b8;font-size:11px;margin:0;line-height:1.45; } .google-help { margin-top:12px;padding:12px;border:1px solid rgba(96,165,250,.3);border-radius:12px;background:rgba(37,99,235,.09); } .google-help strong { display:block;font-size:12px;color:#dbeafe; } .google-help p { margin:5px 0 10px;font-size:11px;line-height:1.4;color:#b9c6df; } .google-actions { display:grid;grid-template-columns:1fr 1fr;gap:7px; } .google-actions button { border:1px solid rgba(129,140,248,.38);border-radius:9px;background:rgba(99,102,241,.16);color:#eef2ff;padding:8px;font-size:10px;font-weight:700;cursor:pointer; } .google-actions button:hover,.google-actions button:focus-visible { background:rgba(99,102,241,.3);outline:2px solid #a78bfa;outline-offset:1px; } .google-status { min-height:14px;margin-top:7px;color:#a7f3d0;font-size:10px; } .footer { padding:13px 18px;border-top:1px solid rgba(148,163,184,.16);font-size:11px;color:#b9c6df;line-height:1.45; } .footer strong { color:#e0e7ff; }
      </style>
      <section class="panel" role="dialog" aria-label="JobAI fill review" aria-modal="false">
        <header class="header"><div><p class="eyebrow">Evidence-led review</p><h3>Application ready for your review</h3></div><button class="close" type="button" aria-label="Close review">×</button></header>
        <p class="summary">JobAI filled only supported profile facts. It never submits an application or accepts legal, consent, diversity, or verification fields for you.</p>
        <div class="stats"><div class="stat"><strong>${Number(fillResult?.count || 0)}</strong><span>filled</span></div><div class="stat"><strong>${suggestions.length + reviewed.length}</strong><span>review</span></div><div class="stat"><strong>${protectedFields.length}</strong><span>protected</span></div></div>
        <div class="body">
          <section class="group"><h4>Missing from Career Passport</h4>${outcomeList(missing.map((key) => ({ key, label: semanticLabel(key), reason: "missing-value" })), "No missing supported facts detected.", "warn")}</section>
          <section class="group"><h4>Suggestions to review</h4>${outcomeList([...reviewed, ...suggestions], "No suggestions need your approval.", "warn")}</section>
          ${googlePickerRequired ? `<section class="google-help"><strong>Google file upload</strong><p>Google protects this picker. Download your saved JobAI resume, then choose it in Google's signed-in window.</p><div class="google-actions"><button class="download-resume" type="button" ${profile?.resume_url ? "" : "disabled"}>1. Get resume</button><button class="open-google-picker" type="button">2. Open picker</button></div><div class="google-status" role="status"></div></section>` : ""}
          <section class="group"><h4>Kept under your control</h4>${outcomeList(protectedFields, "No protected fields detected on this screen.", "manual")}</section>
        </div>
        <footer class="footer"><strong>Privacy first:</strong> update your Career Passport in JobAI Scout, then run fill again. Employer-specific questions are never stored as reusable answers.</footer>
      </section>`;
    shadow.querySelector(".close")?.addEventListener("click", removePanel);
    shadow.querySelector(".download-resume")?.addEventListener("click", async (event) => {
      const button = event.currentTarget;
      const status = shadow.querySelector(".google-status");
      button.disabled = true;
      status.textContent = "Preparing your saved resume…";
      try {
        await downloadSavedResume(profile);
        status.textContent = "Downloaded. Now open Google's picker and select the file.";
      } catch (error) {
        status.textContent = error?.message || "Could not prepare your resume.";
      } finally {
        button.disabled = false;
      }
    });
    shadow.querySelector(".open-google-picker")?.addEventListener("click", () => {
      const picker = findGoogleFilePicker();
      const status = shadow.querySelector(".google-status");
      if (!picker) {
        status.textContent = "The Google picker is not visible. Scroll to the file question and try again.";
        return;
      }
      picker.scrollIntoView({ behavior: "smooth", block: "center" });
      picker.focus?.();
      picker.click();
      status.textContent = "Choose the downloaded resume in Google's signed-in picker.";
    });
  }

  function createLegacySidePanel(fillResult, profile) {
    // Retained only to avoid breaking old injected-page instances. New runs
    // always use the read-only evidence review above and never write a portal
    // value back into the permanent profile.
    return createSidePanel(fillResult);

    removePanel();
    const { count, fields: filledKeys, missing } = fillResult;
    if (!missing || !missing.length) return;

    highlightMissingFields(missing);

    panelHost = document.createElement("div");
    panelHost.id = "jobai-side-panel-host";
    panelHost.style.cssText = "position:fixed;top:0;right:0;z-index:2147483647;pointer-events:none;";
    document.documentElement.appendChild(panelHost);
    const shadow = panelHost.attachShadow({ mode: "closed" });

    const totalFields = (filledKeys?.length || 0) + missing.length;
    const pct = totalFields > 0 ? Math.round(((filledKeys?.length || 0) / totalFields) * 100) : 0;

    const fieldInputs = missing.map(key => {
      const label = FIELD_LABELS[key] || key;
      const isTextarea = key === "summary" || key === "skills";
      if (isTextarea) {
        return `<div class="field-group"><label>${label}</label><textarea data-key="${key}" rows="2" placeholder="Enter ${label.toLowerCase()}"></textarea></div>`;
      }
      const inputType = key === "email" ? "email" : key === "phone" ? "tel" : (key === "linkedin" || key === "github" || key === "portfolio") ? "url" : key === "experience" ? "number" : "text";
      return `<div class="field-group"><label>${label}</label><input type="${inputType}" data-key="${key}" placeholder="Enter ${label.toLowerCase()}" /></div>`;
    }).join("");

    shadow.innerHTML = `
      <style>
        :host { pointer-events: auto; }
        .panel {
          position: fixed; top: 16px; right: 16px; width: 320px; max-height: calc(100vh - 32px);
          background: #fff; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.18);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          font-size: 13px; color: #1a1a1a; overflow: hidden;
          display: flex; flex-direction: column; animation: slideIn 0.3s ease;
        }
        @keyframes slideIn { from { transform: translateX(100%); opacity:0; } to { transform: translateX(0); opacity:1; } }
        .header { padding: 14px 16px; background: linear-gradient(135deg, #3b82f6, #6366f1); color: white; display: flex; align-items: center; justify-content: space-between; }
        .header h3 { margin: 0; font-size: 14px; font-weight: 600; }
        .close-btn { background: rgba(255,255,255,0.2); border: none; color: white; width: 24px; height: 24px; border-radius: 50%; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; }
        .close-btn:hover { background: rgba(255,255,255,0.3); }
        .body { padding: 14px 16px; overflow-y: auto; flex: 1; }
        .summary { display: flex; gap: 8px; margin-bottom: 12px; }
        .stat { flex: 1; text-align: center; padding: 8px 4px; border-radius: 8px; }
        .stat.filled { background: #dcfce7; color: #166534; }
        .stat.missing { background: #fef3c7; color: #92400e; }
        .stat-num { font-size: 20px; font-weight: 700; }
        .stat-label { font-size: 11px; margin-top: 2px; }
        .progress { height: 4px; background: #e5e7eb; border-radius: 2px; margin-bottom: 14px; overflow: hidden; }
        .progress-bar { height: 100%; background: linear-gradient(90deg, #3b82f6, #6366f1); border-radius: 2px; transition: width 0.5s; }
        .section-title { font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 10px; }
        .field-group { margin-bottom: 10px; }
        .field-group label { display: block; font-size: 12px; font-weight: 500; color: #374151; margin-bottom: 4px; }
        .field-group input, .field-group textarea { width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; font-family: inherit; transition: border-color 0.2s; }
        .field-group input:focus, .field-group textarea:focus { border-color: #3b82f6; outline: none; box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }
        .field-group textarea { resize: vertical; min-height: 48px; }
        .actions { padding: 12px 16px; border-top: 1px solid #e5e7eb; display: flex; gap: 8px; }
        .btn { flex: 1; padding: 10px; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
        .btn-primary { background: linear-gradient(135deg, #3b82f6, #6366f1); color: white; }
        .btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .btn-secondary { background: #f3f4f6; color: #374151; }
        .btn-secondary:hover { background: #e5e7eb; }
        .success-msg { text-align: center; padding: 20px 0; }
        .success-msg .icon { font-size: 32px; margin-bottom: 8px; }
        .success-msg p { color: #166534; font-weight: 500; margin: 0; }
        .spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.6s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      </style>
      <div class="panel">
        <div class="header">
          <h3>Job Form Fill</h3>
          <button class="close-btn" id="closePanel">&times;</button>
        </div>
        <div class="body" id="panelBody">
          <div class="summary">
            <div class="stat filled"><div class="stat-num">${count}</div><div class="stat-label">Filled</div></div>
            <div class="stat missing"><div class="stat-num">${missing.length}</div><div class="stat-label">Missing</div></div>
          </div>
          <div class="progress"><div class="progress-bar" style="width:${pct}%"></div></div>
          <p class="section-title">Complete missing fields to auto-fill</p>
          <div id="fieldsArea">${fieldInputs}</div>
        </div>
        <div class="actions" id="actionsArea">
          <button class="btn btn-secondary" id="skipBtn">Skip</button>
          <button class="btn btn-primary" id="saveBtn">Save &amp; Re-fill</button>
        </div>
      </div>
    `;

    shadow.getElementById("closePanel").addEventListener("click", removePanel);
    shadow.getElementById("skipBtn").addEventListener("click", removePanel);
    shadow.getElementById("saveBtn").addEventListener("click", async () => {
      const btn = shadow.getElementById("saveBtn");
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Saving...';

      const inputs = shadow.querySelectorAll("[data-key]");
      const patch = {};
      const newProfile = { ...profile };
      for (const input of inputs) {
        const key = input.dataset.key;
        const val = input.value.trim();
        if (!val) continue;
        const dbKey = KEY_TO_DB[key];
        if (!dbKey) continue;
        if (key === "skills") {
          patch.skills = normalizeList(val);
          newProfile.skills = patch.skills;
        } else if (key === "experience") {
          patch.experience_years = Number(val);
          newProfile.experience_years = patch.experience_years;
        } else if (key === "first_name" || key === "last_name") {
          const parts = (newProfile.full_name || "").trim().split(/\s+/);
          if (key === "first_name") parts[0] = val;
          else parts[parts.length > 1 ? parts.length - 1 : 1] = val;
          patch.full_name = parts.join(" ");
          newProfile.full_name = patch.full_name;
        } else {
          patch[dbKey] = val;
          newProfile[dbKey] = val;
        }
      }

      if (!Object.keys(patch).length) {
        btn.disabled = false;
        btn.innerHTML = "Save & Re-fill";
        return;
      }

      try {
        await saveProfileFromContent(patch);
        const { profile: cached } = await chrome.storage.local.get("profile");
        const merged = { ...(cached || profile), ...patch };
        await chrome.storage.local.set({ profile: merged });

        const body = shadow.getElementById("panelBody");
        const actions = shadow.getElementById("actionsArea");
        body.innerHTML = `<div class="success-msg"><div class="icon">&#10003;</div><p>Profile saved! Re-filling form...</p></div>`;
        actions.style.display = "none";

        clearHighlights();
        await fillWithRetry(newProfile, 4000, 500);
        setTimeout(removePanel, 2500);
      } catch (err) {
        WARN("Side panel save failed:", err);
        btn.disabled = false;
        btn.innerHTML = "Save & Re-fill";
        const body = shadow.getElementById("panelBody");
        const errDiv = document.createElement("div");
        errDiv.style.cssText = "color:#b91c1c;font-size:12px;margin-top:8px;";
        errDiv.textContent = "Save failed: " + (err.message || "Unknown error");
        body.appendChild(errDiv);
      }
    });
  }

  async function saveProfileFromContent() {
    throw new Error("Portal values cannot be saved to your Career Passport from an employer site.");
  }

  // ── In-page application launcher ───────────────────────────────────────
  // Browser extensions are not allowed to open their toolbar popup by
  // themselves. Show this small, in-page launcher instead whenever a genuine
  // application form is detected, so the user gets an immediate entry point.
  let launcherHost = null;

  function isLikelyJobApplication() {
    const url = location.href.toLowerCase();
    const knownApplicantTrackingSystem = /greenhouse\.io|lever\.co|myworkdayjobs\.com|ashbyhq\.com|smartrecruiters\.com|jobvite\.com|icims\.com|apply\.workable\.com/.test(url);
    const fields = collectFields();
    const hasUpload = fields.some((el) => String(el.type || "").toLowerCase() === "file");
    const hasContactField = fields.some((el) => {
      const type = String(el.type || "").toLowerCase();
      return type === "email" || /email|phone|first.?name|last.?name/.test(buildContext(el).text);
    });
    const pageText = String(document.body?.innerText || "").slice(0, 18000).toLowerCase();
    const applicationLanguage = /apply( for this job)?|job application|submit application|additional questions/.test(pageText);
    return (knownApplicantTrackingSystem && (hasContactField || hasUpload)) || (applicationLanguage && hasContactField && fields.length >= 3);
  }

  async function loadProfileForLauncher() {
    const response = await chrome.runtime.sendMessage({ type: "GET_APPLICATION_PROFILE" });
    if (!response?.ok || !response.profile) {
      throw new Error(response?.error || "Could not load your JobAI profile.");
    }
    return response.profile;
  }

  function createApplicationLauncher() {
    if (launcherHost || !isLikelyJobApplication()) return;
    launcherHost = document.createElement("div");
    launcherHost.id = "jobai-application-launcher";
    launcherHost.style.cssText = "position:fixed;right:18px;top:18px;z-index:2147483646;";
    document.documentElement.appendChild(launcherHost);
    const shadow = launcherHost.attachShadow({ mode: "closed" });
    shadow.innerHTML = `
      <style>
        .card { width: 270px; box-sizing:border-box; background:#10152d; color:#f8fafc; border:1px solid rgba(129,140,248,.42); border-radius:14px; box-shadow:0 16px 40px rgba(15,23,42,.35); padding:14px; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; animation:jobai-enter .22s ease-out; }
        @keyframes jobai-enter { from { opacity:0; transform:translateY(-8px) } to { opacity:1; transform:translateY(0) } }
        .top { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:10px; } .brand { font-weight:750; font-size:15px; letter-spacing:-.2px; } .brand span { color:#a78bfa; } .close { border:0; background:transparent; color:#cbd5e1; font-size:21px; line-height:1; cursor:pointer; padding:0 2px; }
        p { color:#b7c0d5; font-size:12px; line-height:1.4; margin:0 0 12px; } button.fill { width:100%; border:0; border-radius:9px; background:linear-gradient(135deg,#6366f1,#8b5cf6); color:white; padding:10px 12px; font-size:13px; font-weight:700; cursor:pointer; } button.fill:hover { filter:brightness(1.08); } button.fill:disabled { opacity:.65; cursor:wait; } .status { min-height:16px; color:#cbd5e1; font-size:11px; margin-top:9px; } .status.ok { color:#86efac; } .status.err { color:#fda4af; }
      </style>
      <section class="card" aria-label="JobAI application helper"><div class="top"><div class="brand">Job<span>AI</span> Form Fill</div><button class="close" aria-label="Close">×</button></div><p>Application detected. Fill your saved profile, answers, and uploaded resume.</p><button class="fill">Auto-fill application</button><div class="status" role="status"></div></section>`;
    const close = shadow.querySelector(".close");
    const fill = shadow.querySelector(".fill");
    const status = shadow.querySelector(".status");
    close.addEventListener("click", () => { launcherHost?.remove(); launcherHost = null; });
    fill.addEventListener("click", async () => {
      fill.disabled = true;
      fill.textContent = "Filling…";
      status.className = "status";
      status.textContent = "Loading your saved profile…";
      try {
        const profile = await loadProfileForLauncher();
        const result = await fillWithRetry(profile, 4000, 500);
        watchDynamic(profile);
        status.className = "status ok";
        status.textContent = `Filled ${result.count} field${result.count === 1 ? "" : "s"}${result.missing.length ? ` · ${result.missing.length} need your input` : ""}.`;
        const reviewCount = (result.missing?.length || 0) + (result.suggestions?.length || 0) + (result.protected?.length || 0);
        status.textContent = `Filled ${result.count} field${result.count === 1 ? "" : "s"}${reviewCount ? ` · ${reviewCount} review item${reviewCount === 1 ? "" : "s"}` : ""}.`;
        fill.textContent = "Fill again";
        if (reviewCount || result.reviewed?.length) createSidePanel(result, profile);
      } catch (error) {
        status.className = "status err";
        status.textContent = error?.message || "Auto-fill failed.";
        fill.textContent = "Try again";
      } finally { fill.disabled = false; }
    });
  }

  // ── Messages ──
  chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
    if (msg?.type === "FILL_FORM") {
      const profile = msg.profile || {};
      fillWithRetry(profile).then((r) => {
        watchDynamic(profile);
        const reviewCount = (r.missing?.length || 0) + (r.suggestions?.length || 0) + (r.protected?.length || 0) + (r.reviewed?.length || 0);
        if (reviewCount) createSidePanel(r, profile);
        sendResponse({
          ok: true,
          count: r.count,
          fields: r.fields,
          missing: r.missing,
          suggestions: r.suggestions,
          protected: r.protected,
          reviewed: r.reviewed,
          url: location.href,
        });
      });
      return true;
    }
    if (msg?.type === "SHOW_PANEL") {
      createSidePanel(msg.fillResult, msg.profile || {});
      sendResponse({ ok: true });
      return true;
    }
    if (msg?.type === "REMOVE_PANEL") {
      removePanel();
      sendResponse({ ok: true });
      return true;
    }
  });

  LOG("Auto-fill engine loaded (text, radio, checkbox, file)");
  setTimeout(createApplicationLauncher, 900);
})();
