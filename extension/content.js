// JobAI Auto-Fill Engine
// Semantic NLP-style field classification, Shadow DOM walking, human-like typing.
// Supports: text inputs, textareas, selects, radio buttons, checkboxes, file uploads.
(function () {
  if (window.__JOBAI_CONTENT_LOADED__) return;
  window.__JOBAI_CONTENT_LOADED__ = true;

  const LOG = (...a) => console.log("%c[JobAI]", "color:#6366f1;font-weight:bold", ...a);
  const WARN = (...a) => console.warn("[JobAI]", ...a);

  const SEMANTICS = [
    { key: "email",      patterns: [/\b(e[\s-]?mail|email address|work email|contact email)\b/i] },
    { key: "phone",      patterns: [/\b(phone|tel(ephone)?|mobile|cell|whatsapp|contact number|phone number)\b/i] },
    { key: "first_name", patterns: [/\b(first name|given name|forename|f[\s-]?name|fname)\b/i, /given-name/i] },
    { key: "last_name",  patterns: [/\b(last name|family name|surname|l[\s-]?name|lname)\b/i, /family-name/i] },
    { key: "full_name",  patterns: [/\b(full name|your name|applicant name|candidate name|legal name|name)\b/i] },
    { key: "linkedin",   patterns: [/linked[\s-]?in|linkedin url|linkedin profile/i] },
    { key: "github",     patterns: [/git[\s-]?hub|github url|github profile/i] },
    { key: "portfolio",  patterns: [/portfolio|personal (site|website)|website|web url/i] },
    { key: "location",   patterns: [/\b(location|city|address|town|region|where.*based|country)\b/i] },
    { key: "company",    patterns: [/\b(current (company|organization|employer)|employer|organization|company)\b/i] },
    { key: "experience", patterns: [/years.*(experience|exp)|experience.*years|how many years/i] },
    { key: "summary",    patterns: [/tell.*about (yourself|you)|about (you|yourself)|summary|bio|introduce|why.*hire|cover letter|motivation|message/i] },
    { key: "skills",     patterns: [/skills|technologies|tech stack|competenc/i] },
    { key: "salary",     patterns: [/salary|compensation|expected pay/i] },
    { key: "education",  patterns: [/education|degree|university|college|school|academic/i] },
    // Radio/Checkbox specific
    { key: "gender",             patterns: [/gender|sex\b|male|female|non[-\s]binary/i] },
    { key: "work_authorization", patterns: [/work (authorization|permit|visa)|authorized to work|legally authorized|sponsorship|visa status|right to work/i] },
    { key: "willing_to_relocate", patterns: [/willing to relocate|relocation|willing to move/i] },
    { key: "availability",       patterns: [/availability|available to start|start date|when can you start|notice period/i] },
    { key: "work_type",          patterns: [/work (type|mode|preference)|full[- ]?time|part[- ]?time|remote|onsite|hybrid|contract/i] },
    { key: "hear_about",         patterns: [/how did you hear|referral|source|where did you find|how did you discover/i] },
    { key: "agree_terms",        patterns: [/i (agree|accept)|terms and conditions|privacy policy|consent|acknowledge/i] },
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

    let best = { key: null, confidence: 0, reason: "no match" };
    for (const sem of SEMANTICS) {
      let hit = 0, base = 0;
      for (const re of sem.patterns) if (re.test(ctx.text)) { hit++; base = Math.max(base, 0.85); }
      if (!hit) continue;
      const inLabel = sem.patterns.some(re => ctx.labelTexts.concat(ctx.ancestors).some(t => re.test(String(t))));
      const conf = Math.min(0.99, base + (inLabel ? 0.1 : 0) + (hit > 1 ? 0.03 : 0));
      if (conf > best.confidence) best = { key: sem.key, confidence: conf, reason: `regex:${sem.key}` };
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
    if (!isVisible(el)) return false;
    const t = (el.type || "").toLowerCase();
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
    el.checked = true;
    el.dispatchEvent(new Event("focus", { bubbles: true }));
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.click();
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
    el.checked = checked;
    el.dispatchEvent(new Event("focus", { bubbles: true }));
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.click();
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  }

  // ── File Upload Fill ──
  const SUPABASE_URL = "https://okppdziaslsitmoqduqg.supabase.co";
  const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rcHBkemlhc2xzaXRtb3FkdXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NzE3MTUsImV4cCI6MjA4ODU0NzcxNX0.yAFcwtZL8P2W-gN8ZyBik_CSA8c84cgBo9qJYouvPkc";

  async function fillFileInput(el, profile, key) {
    const session = await chrome.storage.local.get("session").then(r => r.session);
    if (!session) return false;

    let filePath = null;
    let fileName = "document";

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
        break;
      case "document":
        filePath = profile.document_url;
        fileName = "document.pdf";
        break;
      default:
        return false;
    }

    if (!filePath) return false;

    try {
      // Fetch file from Supabase storage
      const fileUrl = `${SUPABASE_URL}/storage/v1/object/resumes/${filePath}`;
      const res = await fetch(fileUrl, {
        headers: { "Authorization": `Bearer ${session.access_token}`, "apikey": ANON_KEY }
      });
      if (!res.ok) return false;

      const blob = await res.blob();
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
  function resolveValue(profile, key) {
    const cleanVal = (val) => {
      if (!val) return "";
      const s = String(val).trim();
      return s.toLowerCase() === "no" ? "" : s;
    };
    const skills = Array.isArray(profile.skills) ? profile.skills.join(", ") : (profile.skills || "");
    const [first, ...rest] = (profile.full_name || "").trim().split(/\s+/);
    const last = rest.join(" ");
    const rawPortfolio = cleanVal(profile.portfolio_url) || cleanVal(profile.linkedin_url) || cleanVal(profile.github_url);
    const map = {
      // Text fields
      email:      cleanVal(profile.email),
      phone:      cleanVal(profile.phone),
      first_name: first,
      last_name:  last,
      full_name:  profile.full_name,
      linkedin:   cleanVal(profile.linkedin_url),
      github:     cleanVal(profile.github_url),
      portfolio:  rawPortfolio,
      location:   cleanVal(profile.location),
      company:    cleanVal(profile.current_company),
      experience: profile.experience_years ? String(profile.experience_years) : "",
      summary:    cleanVal(profile.cv_summary || profile.bio),
      skills:     cleanVal(skills),
      salary:     cleanVal(profile.expected_salary),
      education:  cleanVal(profile.education),
      // Radio/Checkbox fields
      gender:               cleanVal(profile.gender),
      work_authorization:   cleanVal(profile.work_authorization),
      willing_to_relocate:  cleanVal(profile.willing_to_relocate),
      availability:         cleanVal(profile.availability),
      work_type:            cleanVal(profile.work_type || profile.job_type),
      hear_about:           cleanVal(profile.hear_about),
      agree_terms:          "yes", // Always agree to terms
      // File fields (handled separately, return path)
      resume:         profile.resume_url || "",
      cover_letter:   profile.cover_letter_url || "",
      profile_photo:  profile.avatar_url || profile.profile_picture_url || "",
      document:       profile.document_url || "",
    };
    return map[key] || "";
  }

  // ── Main Fill Pass ──
  const MIN_CONFIDENCE = 0.5;
  const RADIO_CHECK_TYPES = ["radio", "checkbox"];
  const FILE_TYPES = ["resume", "cover_letter", "profile_photo", "document"];

  async function fillForm(profile) {
    const fields = collectFields();
    LOG(`Scanning ${fields.length} candidate field(s)`);
    let count = 0;
    const filledKeys = new Set();
    const missingKeys = new Set();

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

      // Skip already-checked radios/checkboxes
      if (isRadio && el.checked) continue;
      if (isCheckbox && el.checked) continue;

      const { key, confidence, reason } = classify(el);
      if (!key || confidence < MIN_CONFIDENCE) continue;

      // Skip duplicate radio groups
      if (isRadio) {
        const groupKey = `${el.name}`;
        if (processedRadioGroups.has(groupKey)) continue;
        processedRadioGroups.add(groupKey);
      }

      const value = resolveValue(profile, key);

      // Handle file inputs separately
      if (isFile || FILE_TYPES.includes(key)) {
        if (!isFile) continue; // Only handle actual file inputs
        if (!value) { missingKeys.add(key); continue; }
        try {
          if (await fillFileInput(el, profile, key)) {
            count++;
            filledKeys.add(key);
            LOG(`Filled file: ${key}`);
          }
        } catch (e) { WARN("File fill failed:", e); }
        continue;
      }

      if (!value && !isRadio && !isCheckbox) { missingKeys.add(key); continue; }

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
        LOG(`Filled: ${key} (${Math.round(confidence * 100)}%) [${reason}]`);
      } catch (e) { WARN("fill failed", e, el); }
    }

    LOG(`Done — filled ${count} field(s)`);
    return { count, fields: [...filledKeys], missing: [...missingKeys].filter((key) => !filledKeys.has(key)) };
  }

  async function fillWithRetry(profile, totalMs = 5000, intervalMs = 600) {
    const seen = new Set();
    const missing = new Set();
    let total = 0;
    const start = Date.now();
    while (Date.now() - start < totalMs) {
      const r = await fillForm(profile);
      total += r.count;
      for (const f of r.fields) seen.add(f);
      for (const f of r.missing || []) missing.add(f);
      await new Promise(r => setTimeout(r, intervalMs));
    }
    return { count: total, fields: [...seen], missing: [...missing].filter((key) => !seen.has(key)) };
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
  const FIELD_LABELS = {
    email: "Email address", phone: "Phone number", first_name: "First name",
    last_name: "Last name", full_name: "Full name", linkedin: "LinkedIn URL",
    github: "GitHub URL", portfolio: "Portfolio URL", location: "Location",
    company: "Current company", experience: "Years of experience",
    summary: "Profile summary / bio", skills: "Skills", salary: "Expected salary",
    education: "Education", gender: "Gender", work_authorization: "Work authorization",
    willing_to_relocate: "Willing to relocate", availability: "Availability",
    work_type: "Work type preference", hear_about: "How did you hear about us",
  };

  const KEY_TO_DB = {
    email: "email", phone: "phone", first_name: "full_name", last_name: "full_name",
    full_name: "full_name", linkedin: "linkedin_url", github: "github_url",
    portfolio: "portfolio_url", location: "location", company: "current_company",
    experience: "experience_years", summary: "bio", skills: "skills", salary: "expected_salary",
    education: "education", gender: "gender", work_authorization: "work_authorization",
    willing_to_relocate: "willing_to_relocate", availability: "availability",
    work_type: "work_type", hear_about: "hear_about",
  };

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

  function normalizeList(value) {
    if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
    if (typeof value === "string") return value.split(",").map(v => v.trim()).filter(Boolean);
    return [];
  }

  function createSidePanel(fillResult, profile) {
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

  async function saveProfileFromContent(patch) {
    const { session } = await chrome.storage.local.get("session");
    if (!session) throw new Error("Not signed in");
    const userId = session.user.id;
    const headers = {
      "Content-Type": "application/json",
      "apikey": ANON_KEY,
      "Authorization": `Bearer ${session.access_token}`,
      "Prefer": "return=representation",
    };
    const patchRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${encodeURIComponent(userId)}&select=*`,
      { method: "PATCH", headers, body: JSON.stringify(patch) }
    );
    if (patchRes.ok) return patchRes.json();
    const upsertHeaders = { ...headers, "Prefer": "resolution=merge-duplicates,return=representation" };
    const payload = { user_id: userId, email: session.user.email, ...patch };
    const upsertRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?on_conflict=user_id&select=*`,
      { method: "POST", headers: upsertHeaders, body: JSON.stringify(payload) }
    );
    if (!upsertRes.ok) {
      const errData = await upsertRes.json().catch(() => ({}));
      const errMsg = [errData.message, errData.details, errData.hint].filter(Boolean).join(" ");
      const colMatch = errMsg.match(/'([^']+)'\s+column/i) || errMsg.match(/column\s+"([^"]+)"/i);
      if (colMatch && colMatch[1] in payload) {
        delete payload[colMatch[1]];
        const retryRes = await fetch(
          `${SUPABASE_URL}/rest/v1/profiles?on_conflict=user_id&select=*`,
          { method: "POST", headers: upsertHeaders, body: JSON.stringify(payload) }
        );
        if (retryRes.ok) return retryRes.json();
      }
      throw new Error(errData.message || `HTTP ${upsertRes.status}`);
    }
    return upsertRes.json();
  }

  // ── Messages ──
  chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
    if (msg?.type === "FILL_FORM") {
      const profile = msg.profile || {};
      fillWithRetry(profile).then((r) => {
        watchDynamic(profile);
        sendResponse({ ok: true, count: r.count, fields: r.fields, missing: r.missing, url: location.href });
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
})();
