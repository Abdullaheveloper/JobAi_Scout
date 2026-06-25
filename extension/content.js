// JobAI Universal Autofill Engine
// Production-grade autofill for Google Forms, React/Next, LinkedIn, Workday,
// Lever, Greenhouse, and generic HTML — with Shadow DOM, iframes, MutationObserver,
// semantic NLP-style classification, confidence scoring, and human-like typing.
(function () {
  // Guard against double-injection
  if (window.__JOBAI_CONTENT_LOADED__) return;
  window.__JOBAI_CONTENT_LOADED__ = true;

  const LOG = (...a) => console.log("%c[JobAI]", "color:#6366f1;font-weight:bold", ...a);
  const WARN = (...a) => console.warn("[JobAI]", ...a);

  // ---------------- SEMANTIC DICTIONARY ----------------
  // Each entry: keyword regex tested against combined context text.
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
  ];

  // ---------------- DOM WALKING ----------------
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

  // ---------------- CONTEXT EXTRACTION ----------------
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
      // Google Forms: each question lives in role="listitem"
      if (p.getAttribute?.("role") === "listitem") {
        const heading = p.querySelector("[role='heading']")?.innerText
          || p.querySelector(".M7eMe, .HoXoMd")?.innerText
          || p.innerText?.split("\n")[0];
        if (heading) parts.push(heading);
        break; // listitem is the question container — stop here
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

  // ---------------- CLASSIFICATION + CONFIDENCE ----------------
  function classify(el) {
    // Hard signals first
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

    // Score every semantic; pick best.
    let best = { key: null, confidence: 0, reason: "no match" };
    for (const sem of SEMANTICS) {
      let hit = 0, base = 0;
      for (const re of sem.patterns) if (re.test(ctx.text)) { hit++; base = Math.max(base, 0.85); }
      if (!hit) continue;
      // Bonus: pattern matched in a label/ancestor (more reliable than placeholder).
      const inLabel = sem.patterns.some(re => ctx.labelTexts.concat(ctx.ancestors).some(t => re.test(String(t))));
      const conf = Math.min(0.99, base + (inLabel ? 0.1 : 0) + (hit > 1 ? 0.03 : 0));
      if (conf > best.confidence) best = { key: sem.key, confidence: conf, reason: `regex:${sem.key}` };
    }
    return best;
  }

  // ---------------- FILL HELPERS ----------------
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
    if (["hidden","submit","button","file","image","reset"].includes(t)) return false;
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
    // Type in small chunks to look human-ish without being painfully slow.
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

  // ---------------- VALUE RESOLUTION ----------------
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
    };
    return map[key] || "";
  }

  // ---------------- MAIN FILL PASS ----------------
  const MIN_CONFIDENCE = 0.5;
  async function fillForm(profile) {
    const fields = collectFields();
    LOG(`Scanning ${fields.length} candidate field(s) on`, location.href);
    let count = 0;
    const filledKeys = new Set();
    const missingKeys = new Set();
    const debug = [];

    for (const el of fields) {
      if (!isFillable(el)) { debug.push({ el, status: "not-fillable" }); continue; }
      // Skip already filled text inputs unless empty
      const isCE = el.getAttribute?.("contenteditable") === "true";
      const currentVal = isCE ? el.innerText : el.value;
      if (currentVal && String(currentVal).trim().length > 0) { debug.push({ el, status: "already-filled" }); continue; }

      const { key, confidence, reason } = classify(el);
      if (!key) {
        const ctx = buildContext(el);
        debug.push({ el, status: "no-semantic-match", contextText: ctx.text.slice(0, 200) });
        continue;
      }
      if (confidence < MIN_CONFIDENCE) { debug.push({ el, key, confidence, status: "low-confidence" }); continue; }

      const value = resolveValue(profile, key);
      if (!value) {
        missingKeys.add(key);
        debug.push({ el, key, confidence, status: "no-value" });
        continue;
      }

      try {
        if (el.tagName === "SELECT") {
          if (fillSelect(el, value)) { count++; filledKeys.add(key); debug.push({ key, confidence, status: "filled-select" }); }
        } else if (isCE) {
          fillContentEditable(el, value);
          count++; filledKeys.add(key);
          debug.push({ key, confidence, status: "filled-ce" });
        } else {
          await humanType(el, value);
          count++; filledKeys.add(key);
          debug.push({ key, confidence, status: "filled" });
        }
        LOG(`✓ ${key} (${Math.round(confidence*100)}%) [${reason}]`, el);
      } catch (e) {
        WARN("fill failed", e, el);
      }
    }

    LOG(`Done — filled ${count} field(s)`, { keys: [...filledKeys], debug });
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

  // ---------------- EMAIL DETECTION (verification gate) ----------------
  function detectPageEmail() {
    for (const el of collectFields()) {
      if (el.tagName !== "INPUT") continue;
      const cls = classify(el);
      if (cls.key === "email" && el.value && /\S+@\S+\.\S+/.test(el.value)) return el.value.trim();
    }
    const re = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const m = (document.body?.innerText || "").match(re);
    return (m && m[0]) || "";
  }

  // ---------------- SUBMIT TRACKING ----------------
  function detectJobMeta() {
    const host = location.hostname;
    const platform = host.replace(/^www\./, "").split(".")[0];
    const og = (p) => document.querySelector(`meta[property="${p}"]`)?.content || "";
    const title = og("og:title") || document.querySelector("h1")?.innerText || document.title || "Job application";
    let company = "";
    if (host.includes("greenhouse")) company = document.querySelector(".company-name, [class*='company']")?.innerText || "";
    if (host.includes("lever"))      company = document.querySelector(".main-header-logo img")?.alt || document.querySelector(".posting-headline h2")?.innerText || "";
    if (host.includes("linkedin"))   company = document.querySelector(".jobs-unified-top-card__company-name a, .topcard__org-name-link")?.innerText || "";
    if (host.includes("indeed"))     company = document.querySelector("[data-company-name], .jobsearch-CompanyInfoContainer a")?.innerText || "";
    if (!company) company = og("og:site_name") || host;
    return {
      job_title: (title || "").trim().slice(0, 300),
      company:   (company || "").trim().slice(0, 200),
      job_url:   location.href,
      platform,
    };
  }

  let armed = false;
  function armSubmitTracker() {
    if (armed) return; armed = true;
    const handler = () => {
      const payload = detectJobMeta();
      try { chrome.runtime.sendMessage({ type: "APPLICATION_SUBMITTED", payload }); } catch {}
    };
    document.addEventListener("submit", handler, true);
    document.addEventListener("click", (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      const btn = t.closest("button, [role='button'], input[type='submit']");
      if (!btn) return;
      const txt = (btn.innerText || btn.value || "").toLowerCase();
      if (/submit|apply|send application/.test(txt)) setTimeout(handler, 1500);
    }, true);
  }

  // ---------------- INTELLIGENT SIDE PANEL (Enhancement Layer) ----------------
  const SUPABASE_URL = "https://okppdziaslsitmoqduqg.supabase.co";
  const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rcHBkemlhc2xzaXRtb3FkdXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NzE3MTUsImV4cCI6MjA4ODU0NzcxNX0.yAFcwtZL8P2W-gN8ZyBik_CSA8c84cgBo9qJYouvPkc";

  const FIELD_LABELS = {
    email: "Email address", phone: "Phone number", first_name: "First name",
    last_name: "Last name", full_name: "Full name", linkedin: "LinkedIn URL",
    github: "GitHub URL", portfolio: "Portfolio URL", location: "Location",
    company: "Current company", experience: "Years of experience",
    summary: "Profile summary / bio", skills: "Skills", salary: "Expected salary",
  };

  // Map content.js keys → profile DB keys
  const KEY_TO_DB = {
    email: "email", phone: "phone", first_name: "full_name", last_name: "full_name",
    full_name: "full_name", linkedin: "linkedin_url", github: "github_url",
    portfolio: "portfolio_url", location: "location", company: "current_company",
    experience: "experience_years", summary: "bio", skills: "skills", salary: "expected_salary",
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
    if (panelHost) {
      try { panelHost.remove(); } catch {}
      panelHost = null;
    }
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
    if (!missing || !missing.length) return; // No missing fields, no panel needed

    highlightMissingFields(missing);

    // Create shadow DOM host
    panelHost = document.createElement("div");
    panelHost.id = "jobai-side-panel-host";
    panelHost.style.cssText = "position:fixed;top:0;right:0;z-index:2147483647;pointer-events:none;";
    document.documentElement.appendChild(panelHost);
    const shadow = panelHost.attachShadow({ mode: "closed" });

    const totalFields = (filledKeys?.length || 0) + missing.length;
    const pct = totalFields > 0 ? Math.round(((filledKeys?.length || 0) / totalFields) * 100) : 0;

    // Build field inputs
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
        .header {
          padding: 14px 16px; background: linear-gradient(135deg, #3b82f6, #6366f1);
          color: white; display: flex; align-items: center; justify-content: space-between;
        }
        .header h3 { margin: 0; font-size: 14px; font-weight: 600; }
        .close-btn { background: rgba(255,255,255,0.2); border: none; color: white; width: 24px; height: 24px;
          border-radius: 50%; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; }
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
        .section-title { font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase;
          letter-spacing: 0.5px; margin: 0 0 10px; }
        .field-group { margin-bottom: 10px; }
        .field-group label { display: block; font-size: 12px; font-weight: 500; color: #374151; margin-bottom: 4px; }
        .field-group input, .field-group textarea {
          width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #d1d5db;
          border-radius: 6px; font-size: 13px; font-family: inherit; transition: border-color 0.2s;
        }
        .field-group input:focus, .field-group textarea:focus { border-color: #3b82f6; outline: none; box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }
        .field-group textarea { resize: vertical; min-height: 48px; }
        .actions { padding: 12px 16px; border-top: 1px solid #e5e7eb; display: flex; gap: 8px; }
        .btn { flex: 1; padding: 10px; border: none; border-radius: 8px; font-size: 13px;
          font-weight: 600; cursor: pointer; transition: all 0.2s; }
        .btn-primary { background: linear-gradient(135deg, #3b82f6, #6366f1); color: white; }
        .btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .btn-secondary { background: #f3f4f6; color: #374151; }
        .btn-secondary:hover { background: #e5e7eb; }
        .success-msg { text-align: center; padding: 20px 0; }
        .success-msg .icon { font-size: 32px; margin-bottom: 8px; }
        .success-msg p { color: #166534; font-weight: 500; margin: 0; }
        .spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white; border-radius: 50%; animation: spin 0.6s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      </style>
      <div class="panel">
        <div class="header">
          <h3>JobAI Auto-Fill</h3>
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

    // Event listeners
    shadow.getElementById("closePanel").addEventListener("click", removePanel);
    shadow.getElementById("skipBtn").addEventListener("click", removePanel);
    shadow.getElementById("saveBtn").addEventListener("click", async () => {
      const btn = shadow.getElementById("saveBtn");
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Saving...';

      // Collect values from panel inputs
      const inputs = shadow.querySelectorAll("[data-key]");
      const patch = {};
      const newProfile = { ...profile };
      for (const input of inputs) {
        const key = input.dataset.key;
        const val = input.value.trim();
        if (!val) continue;
        const dbKey = KEY_TO_DB[key];
        if (!dbKey) continue;
        // Handle special types
        if (key === "skills") {
          patch.skills = normalizeList(val);
          newProfile.skills = patch.skills;
        } else if (key === "experience") {
          patch.experience_years = Number(val);
          newProfile.experience_years = patch.experience_years;
        } else if (key === "first_name" || key === "last_name") {
          // Combine with existing name
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
        // Update local cache
        const { profile: cached } = await chrome.storage.local.get("profile");
        const merged = { ...(cached || profile), ...patch };
        await chrome.storage.local.set({ profile: merged });

        // Show success
        const body = shadow.getElementById("panelBody");
        const actions = shadow.getElementById("actionsArea");
        body.innerHTML = `<div class="success-msg"><div class="icon">&#10003;</div><p>Profile saved! Re-filling form...</p></div>`;
        actions.style.display = "none";

        // Re-fill the form with updated profile
        clearHighlights();
        await fillWithRetry(newProfile, 4000, 500);

        // Auto-close after delay
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

  // Direct Supabase save from content script
  async function saveProfileFromContent(patch) {
    const { session } = await chrome.storage.local.get("session");
    if (!session) throw new Error("Not signed in");
    const userId = session.user.id;

    // Try PATCH first, fallback to POST with upsert
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

    // If PATCH failed (no rows), try upsert
    const upsertHeaders = { ...headers, "Prefer": "resolution=merge-duplicates,return=representation" };
    const payload = { user_id: userId, email: session.user.email, ...patch };
    const upsertRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?on_conflict=user_id&select=*`,
      { method: "POST", headers: upsertHeaders, body: JSON.stringify(payload) }
    );

    if (!upsertRes.ok) {
      const errData = await upsertRes.json().catch(() => ({}));
      // Try removing unknown columns
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

  // ---------------- MULTI-PORTAL JOB SCRAPING ----------------

  function cleanText(text) { return (text || "").replace(/\s+/g, " ").trim(); }

  function extractSkills(text) {
    const keywords = (text || "").match(
      /(?:React|Node\.js|Python|Java|TypeScript|JavaScript|SQL|AWS|Docker|Kubernetes|Git|Angular|Vue|MongoDB|PostgreSQL|GraphQL|REST|CI\/CD|Agile|Scrum|C\+\+|Go|Rust|Ruby|Swift|Kotlin|Flutter|TensorFlow|PyTorch|Next\.js|Express|Django|Spring|Azure|GCP|Linux|HTML|CSS|Sass|Figma|Redis|Elasticsearch|PHP|Laravel|\.NET|C#|Scala|Perl|R|MATLAB|Tableau|Power BI|Jira|Salesforce|Shopify|WordPress|Unity|Unreal|Blender|Adobe|Photoshop|Machine Learning|Deep Learning|NLP|Computer Vision|Data Science|DevOps|SRE|Terraform|Ansible|Jenkins|GitHub Actions|Microservices|API|OAuth|JWT|gRPC|Kafka|RabbitMQ|Spark|Hadoop|Airflow|Snowflake|BigQuery|Firebase|Supabase|Vercel|Netlify)/gi
    ) || [];
    return [...new Set(keywords)].slice(0, 15);
  }

  function detectEmploymentType(text) {
    const t = (text || "").toLowerCase();
    if (/remote/i.test(t)) return "Remote";
    if (/hybrid/i.test(t)) return "Hybrid";
    if (/contract|freelance|temp/i.test(t)) return "Contract";
    if (/part[- ]time/i.test(t)) return "Part-time";
    if (/intern|internship/i.test(t)) return "Internship";
    return "Full-time";
  }

  // ── LinkedIn Scraper (updated for modern LinkedIn DOM) ──
  function scrapeLinkedIn() {
    const jobs = [];
    
    // Strategy 1: LinkedIn Job Search results page (most common)
    const searchCards = document.querySelectorAll(
      '.jobs-search-results__list-item, ' +
      '.jobs-search-results-list li, ' +
      '.scaffold-layout__list-container li, ' +
      '.job-card-container, ' +
      '.job-card-list__entity-lockup, ' +
      '.base-card, ' +
      '.job-search-card, ' +
      '[data-occludable-job-id]'
    );
    
    searchCards.forEach(card => {
      const title = cleanText(
        card.querySelector('.job-card-list__title, .job-card-container__link, .base-search-card__title, a.job-card-list__title--link, .artdeco-entity-lockup__title')?.textContent ||
        card.querySelector('h3, a[class*="title"]')?.textContent
      );
      const company = cleanText(
        card.querySelector('.job-card-container__primary-description, .base-search-card__subtitle, .artdeco-entity-lockup__subtitle, .job-card-container__company-name')?.textContent ||
        card.querySelector('[class*="company"]')?.textContent
      );
      const location = cleanText(
        card.querySelector('.job-card-container__metadata-item, .base-search-card__metadata .job-search-card__location, .artdeco-entity-lockup__caption, .job-card-container__metadata-wrapper')?.textContent ||
        card.querySelector('[class*="location"]')?.textContent
      );
      const url = card.querySelector('a[href*="/jobs/"]')?.href || card.querySelector('a')?.href || "";
      const logo = card.querySelector('img')?.src || "";
      const postedDate = card.querySelector('time')?.getAttribute('datetime') || '';
      
      if (title && company) {
        jobs.push({
          title, company, location,
          source_portal: "linkedin",
          source_url: url.split('?')[0],
          company_logo: logo,
          skills_required: extractSkills(title + " " + company),
          employment_type: detectEmploymentType(card.textContent || ""),
          posted_date: postedDate
        });
      }
    });

    // Strategy 2: LinkedIn job detail page (single job view)
    if (jobs.length === 0) {
      const detailTitle = cleanText(
        document.querySelector('.jobs-unified-top-card__job-title, .top-card-layout__title, h1.t-24, h1[class*="job-title"], .topcard__title')?.textContent
      );
      const detailCompany = cleanText(
        document.querySelector('.jobs-unified-top-card__company-name a, .topcard__org-name-link, a.topcard__org-name-link, [class*="company-name"]')?.textContent
      );
      const detailLocation = cleanText(
        document.querySelector('.jobs-unified-top-card__bullet, .topcard__flavor--bullet, [class*="job-location"]')?.textContent
      );
      const detailDesc = cleanText(
        document.querySelector('.jobs-description__content, .description__text, .show-more-less-html__markup')?.textContent
      );
      
      if (detailTitle && detailCompany) {
        jobs.push({
          title: detailTitle,
          company: detailCompany,
          location: detailLocation,
          description: detailDesc?.slice(0, 800) || "",
          source_portal: "linkedin",
          source_url: window.location.href.split('?')[0],
          skills_required: extractSkills(detailTitle + " " + (detailDesc || "")),
          employment_type: detectEmploymentType(detailDesc || "")
        });
      }
    }

    // Strategy 3: LinkedIn public jobs page (unauthenticated)
    if (jobs.length === 0) {
      const publicCards = document.querySelectorAll('.result-card, .result-card--with-hover-state, ul.jobs-search__results-list > li');
      publicCards.forEach(card => {
        const title = cleanText(card.querySelector('h3, .result-card__title, .base-search-card__title')?.textContent);
        const company = cleanText(card.querySelector('h4, .result-card__subtitle, .base-search-card__subtitle')?.textContent);
        const location = cleanText(card.querySelector('.job-search-card__location, .result-card__meta-item')?.textContent);
        const url = card.querySelector('a')?.href || "";
        if (title && company) {
          jobs.push({
            title, company, location,
            source_portal: "linkedin",
            source_url: url.split('?')[0],
            skills_required: extractSkills(title + " " + company),
            employment_type: detectEmploymentType(card.textContent || "")
          });
        }
      });
    }

    return jobs;
  }

  // ── Indeed Scraper (updated selectors) ──
  function scrapeIndeed() {
    const cards = document.querySelectorAll('.job_seen_beacon, .jobsearch-ResultsList .result, .tapItem, .cardOutline, .resultContent, [data-jk]');
    const jobs = [];
    cards.forEach(card => {
      const titleEl = card.querySelector('.jobTitle > a, .jobTitle a, h2.jobTitle a, h2.jobTitle span, a.jcs-JobTitle');
      const title = cleanText(titleEl?.textContent);
      const company = cleanText(card.querySelector('[data-testid="company-name"], .companyName, .company, [class*="companyName"]')?.textContent);
      const location = cleanText(card.querySelector('[data-testid="text-location"], .companyLocation, .location, [class*="companyLocation"]')?.textContent);
      const salary = cleanText(card.querySelector('.metadata.salary-snippet-container, .salary-snippet-container, [class*="salary"], .estimated-salary')?.textContent);
      const url = titleEl?.href || card.querySelector('a')?.href || "";
      const snippet = cleanText(card.querySelector('.job-snippet, .underShelfFooter, [class*="job-snippet"], .heading6')?.textContent);
      if (title && company) jobs.push({ title, company, location, salary, source_portal: "indeed", source_url: url.split('?')[0], description: snippet, skills_required: extractSkills(title + " " + snippet), employment_type: detectEmploymentType(card.textContent) });
    });
    
    // Fallback: single job detail page
    if (jobs.length === 0) {
      const detailTitle = cleanText(document.querySelector('.jobsearch-JobInfoHeader-title, h1[class*="JobTitle"], .icl-u-xs-mb--xs h1')?.textContent);
      const detailCompany = cleanText(document.querySelector('[data-company-name], .jobsearch-CompanyInfoContainer a, .css-1cjkto6 a')?.textContent);
      const detailLocation = cleanText(document.querySelector('.css-6z8o9s, [class*="jobLocation"], .jobsearch-JobInfoHeader-subtitle > div:nth-child(2)')?.textContent);
      const detailDesc = cleanText(document.querySelector('#jobDescriptionText, .jobsearch-jobDescriptionText')?.textContent);
      if (detailTitle && detailCompany) {
        jobs.push({ title: detailTitle, company: detailCompany, location: detailLocation, description: detailDesc?.slice(0, 800) || "", source_portal: "indeed", source_url: window.location.href.split('?')[0], skills_required: extractSkills(detailTitle + " " + (detailDesc || "")), employment_type: detectEmploymentType(detailDesc || "") });
      }
    }

    return jobs;
  }

  function scrapeGlassdoor() {
    const cards = document.querySelectorAll('[data-test="jobListing"], .react-job-listing, li[data-jobid], [class*="JobCard"], [data-id]');
    const jobs = [];
    cards.forEach(card => {
      const title = cleanText(card.querySelector('[data-test="job-title"], a[data-test="job-title"], .jobLink, a.jobLink, [class*="jobTitle"]')?.textContent);
      const company = cleanText(card.querySelector('[data-test="employer-short-name"], .employer-name, .employerName, [class*="employerName"]')?.textContent);
      const location = cleanText(card.querySelector('[data-test="emp-location"], .location, .empLocation, [class*="location"]')?.textContent);
      const salary = cleanText(card.querySelector('[data-test="detailSalary"], [class*="salaryEstimate"], .salary-estimate')?.textContent);
      const url = card.querySelector('a[data-test="job-title"]')?.href || card.querySelector('a.jobLink')?.href || card.querySelector('a')?.href || "";
      if (title && company) jobs.push({ title, company, location, salary, source_portal: "glassdoor", source_url: url, skills_required: extractSkills(title + " " + company), employment_type: detectEmploymentType(card.textContent) });
    });
    return jobs;
  }

  function scrapeMonster() {
    const cards = document.querySelectorAll('.card-content, .results-card, .serp-job-card, [data-testid="job-card"]');
    const jobs = [];
    cards.forEach(card => {
      const title = cleanText(card.querySelector('.job-title, .card-title, h2, a.job-title-link')?.textContent);
      const company = cleanText(card.querySelector('.company-name, .company, [data-testid="job-card-company"]')?.textContent);
      const location = cleanText(card.querySelector('.job-location, .location, [data-testid="job-card-location"]')?.textContent);
      const url = card.querySelector('a')?.href || "";
      if (title && company) jobs.push({ title, company, location, source_portal: "monster", source_url: url, skills_required: extractSkills(title + " " + company), employment_type: detectEmploymentType(card.textContent) });
    });
    return jobs;
  }

  function scrapeBayt() {
    const cards = document.querySelectorAll('.job-card, .t-underline, .card, li.has-pointer, [class*="JobCard"]');
    const jobs = [];
    cards.forEach(card => {
      const title = cleanText(card.querySelector('.job-card__job-title, h2, a.t-black, .job-title, a')?.textContent);
      const company = cleanText(card.querySelector('.job-card__job-company, .company-name, .t-14')?.textContent);
      const location = cleanText(card.querySelector('.job-card__job-location, .location, .t-12')?.textContent);
      const url = card.querySelector('a')?.href || "";
      if (title && company) jobs.push({ title, company, location, source_portal: "bayt", source_url: url, skills_required: extractSkills(title + " " + company), employment_type: detectEmploymentType(card.textContent) });
    });
    return jobs;
  }

  function scrapeRozee() {
    const cards = document.querySelectorAll('.job-listing, .job-card, .panel-body .row, [class*="job"]');
    const jobs = [];
    cards.forEach(card => {
      const title = cleanText(card.querySelector('.job-title, h3, a.job-link, a')?.textContent);
      const company = cleanText(card.querySelector('.job-company, .company-name, .company')?.textContent);
      const location = cleanText(card.querySelector('.job-location, .location')?.textContent);
      const url = card.querySelector('a')?.href || "";
      if (title && company) jobs.push({ title, company, location, source_portal: "rozee", source_url: url, skills_required: extractSkills(title + " " + company), employment_type: detectEmploymentType(card.textContent) });
    });
    return jobs;
  }

  function scrapeWellfound() {
    const cards = document.querySelectorAll('[class*="StartupJobCard"], [class*="job-card"], [class*="JobCard"], .listing');
    const jobs = [];
    cards.forEach(card => {
      const title = cleanText(card.querySelector('[class*="title"], h3, a, .job-title')?.textContent);
      const company = cleanText(card.querySelector('[class*="company"], .company-name, [class*="Company"]')?.textContent);
      const location = cleanText(card.querySelector('[class*="location"], .location')?.textContent);
      const salary = cleanText(card.querySelector('[class*="salary"], [class*="compensation"]')?.textContent);
      const url = card.querySelector('a')?.href || "";
      if (title && company) jobs.push({ title, company, location, salary, source_portal: "wellfound", source_url: url, skills_required: extractSkills(title + " " + card.textContent), employment_type: detectEmploymentType(card.textContent) });
    });
    return jobs;
  }

  function scrapeDice() {
    const cards = document.querySelectorAll('[class*="job-card"], .card, [data-cy="job-card"], article');
    const jobs = [];
    cards.forEach(card => {
      const title = cleanText(card.querySelector('[class*="title"], h3, a.card-link, .job-title')?.textContent);
      const company = cleanText(card.querySelector('[class*="company"], .company-name, [class*="employer"]')?.textContent);
      const location = cleanText(card.querySelector('[class*="location"], .location')?.textContent);
      const url = card.querySelector('a')?.href || "";
      if (title && company) jobs.push({ title, company, location, source_portal: "dice", source_url: url, skills_required: extractSkills(title + " " + card.textContent), employment_type: detectEmploymentType(card.textContent) });
    });
    return jobs;
  }

  function scrapeCareerBuilder() {
    const cards = document.querySelectorAll('.job-card, .results-card, [class*="job-result"], [class*="JobCard"]');
    const jobs = [];
    cards.forEach(card => {
      const title = cleanText(card.querySelector('.job-title, h2, a.job-title-link, a')?.textContent);
      const company = cleanText(card.querySelector('.company-name, .company, [class*="company"]')?.textContent);
      const location = cleanText(card.querySelector('.job-location, .location, [class*="location"]')?.textContent);
      const url = card.querySelector('a')?.href || "";
      if (title && company) jobs.push({ title, company, location, source_portal: "careerbuilder", source_url: url, skills_required: extractSkills(title + " " + company), employment_type: detectEmploymentType(card.textContent) });
    });
    return jobs;
  }

  function scrapeGreenhouse() {
    const jobs = [];
    const host = window.location.hostname;
    if (document.querySelector('h1.app-title') || document.querySelector('#header h1')) {
      const title = cleanText(document.querySelector('h1.app-title, #header h1')?.textContent);
      const location = cleanText(document.querySelector('.location')?.textContent);
      const description = cleanText(document.querySelector('#content, .description, #main')?.textContent || document.body.innerText);
      const company = cleanText(document.querySelector('.company-name, #header span.company')?.textContent) || host.replace("boards.greenhouse.io", "").split(".")[0] || "Greenhouse Job";
      const url = window.location.href;
      if (title) {
        jobs.push({
          title,
          company,
          location,
          description: description.slice(0, 800),
          source_portal: "greenhouse",
          source_url: url,
          skills_required: extractSkills(title + " " + description),
          employment_type: detectEmploymentType(description)
        });
      }
    } else {
      const cards = document.querySelectorAll('.opening, [data-qa="opening"]');
      cards.forEach(card => {
        const titleEl = card.querySelector('a');
        const title = cleanText(titleEl?.textContent);
        const location = cleanText(card.querySelector('.location')?.textContent);
        const url = titleEl?.href || "";
        const company = host.replace("boards.greenhouse.io", "").split(".")[0] || "Greenhouse Company";
        if (title) {
          jobs.push({
            title,
            company,
            location,
            description: `Job opportunity at ${company}`,
            source_portal: "greenhouse",
            source_url: url,
            skills_required: extractSkills(title),
            employment_type: "Full-time"
          });
        }
      });
    }
    return jobs;
  }

  function scrapeLever() {
    const jobs = [];
    const host = window.location.hostname;
    if (document.querySelector('.posting-headline h2')) {
      const title = cleanText(document.querySelector('.posting-headline h2')?.textContent);
      const location = cleanText(document.querySelector('.posting-categories .location, .location')?.textContent);
      const description = cleanText(document.querySelector('.section.page-centered, .section.job-description')?.textContent || document.body.innerText);
      const company = cleanText(document.querySelector('.main-header-logo img')?.alt) || host.replace("jobs.lever.co", "").split(".")[0] || "Lever Job";
      const url = window.location.href;
      if (title) {
        jobs.push({
          title,
          company,
          location,
          description: description.slice(0, 800),
          source_portal: "lever",
          source_url: url,
          skills_required: extractSkills(title + " " + description),
          employment_type: detectEmploymentType(description)
        });
      }
    } else {
      const cards = document.querySelectorAll('.posting');
      cards.forEach(card => {
        const titleEl = card.querySelector('.posting-title h5, h5, a');
        const title = cleanText(titleEl?.textContent);
        const location = cleanText(card.querySelector('.posting-categories .location, .location')?.textContent);
        const url = card.querySelector('a')?.href || "";
        const company = host.replace("jobs.lever.co", "").split(".")[0] || "Lever Company";
        if (title) {
          jobs.push({
            title,
            company,
            location,
            description: `Job opportunity at ${company}`,
            source_portal: "lever",
            source_url: url,
            skills_required: extractSkills(title),
            employment_type: detectEmploymentType(card.textContent)
          });
        }
      });
    }
    return jobs;
  }

  function scrapeGeneric() {
    const cards = document.querySelectorAll('article, [class*="job-card"], [class*="jobCard"], [class*="job-listing"], [class*="jobListing"], [class*="job-result"], [data-job-id], [data-jobid]');
    const jobs = [];
    cards.forEach(card => {
      const titleEl = card.querySelector('h1, h2, h3, h4, a[class*="title"], [class*="job-title"], [class*="jobTitle"]');
      const title = cleanText(titleEl?.textContent);
      const company = cleanText(card.querySelector('[class*="company"], [class*="employer"], .company')?.textContent);
      const location = cleanText(card.querySelector('[class*="location"], [class*="city"], .location')?.textContent);
      const url = titleEl?.href || card.querySelector('a')?.href || "";
      if (title && company) {
        const portal = window.location.hostname.replace(/^www\./, "").split(".")[0];
        jobs.push({ title, company, location, source_portal: portal || "web", source_url: url, skills_required: extractSkills(title + " " + card.textContent), employment_type: detectEmploymentType(card.textContent) });
      }
    });
    return jobs;
  }

  function scanJobs(portal) {
    LOG("Scanning jobs on:", portal, "URL:", location.href);
    const scrapers = {
      linkedin: scrapeLinkedIn, indeed: scrapeIndeed, glassdoor: scrapeGlassdoor,
      monster: scrapeMonster, bayt: scrapeBayt, rozee: scrapeRozee,
      wellfound: scrapeWellfound, dice: scrapeDice, careerbuilder: scrapeCareerBuilder,
      greenhouse: scrapeGreenhouse, lever: scrapeLever,
    };
    let jobs = (scrapers[portal] || scrapeGeneric)();
    // If portal-specific scraper found nothing, fall back to generic
    if (!jobs.length) jobs = scrapeGeneric();
    // Deduplicate by title+company
    const seen = new Set();
    jobs = jobs.filter(j => { const key = `${j.title.toLowerCase()}|${j.company.toLowerCase()}`; if (seen.has(key)) return false; seen.add(key); return true; });
    LOG(`Found ${jobs.length} job(s) on ${portal}`);
    return jobs;
  }

  // ---------------- MESSAGING ----------------
  chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
    if (msg?.type === "DETECT_EMAIL") {
      sendResponse({ email: detectPageEmail() }); return true;
    }
    if (msg?.type === "FILL_FORM") {
      const profile = msg.profile || {};
      fillWithRetry(profile).then((r) => {
        watchDynamic(profile);
        sendResponse({ ok: true, count: r.count, fields: r.fields, missing: r.missing, url: location.href });
      });
      return true;
    }
    if (msg?.type === "SCAN_JOBS") {
      try {
        const jobs = scanJobs(msg.portal);
        sendResponse({ ok: true, jobs, count: jobs.length });
      } catch (e) {
        LOG("Scan error:", e);
        sendResponse({ ok: false, jobs: [], count: 0, error: e.message });
      }
      return true;
    }
    if (msg?.type === "SHOW_PANEL") {
      const { fillResult, profile } = msg;
      createSidePanel(fillResult, profile || {});
      sendResponse({ ok: true });
      return true;
    }
    if (msg?.type === "ARM_SUBMIT_TRACKER") {
      armSubmitTracker(); sendResponse({ ok: true }); return true;
    }
    if (msg?.type === "REMOVE_PANEL") {
      removePanel(); sendResponse({ ok: true }); return true;
    }
  });

  LOG("Universal autofill engine loaded");
})();
