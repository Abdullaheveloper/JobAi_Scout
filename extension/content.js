// JobAI Universal Autofill Engine
// Production-grade autofill for Google Forms, React/Next, LinkedIn, Workday,
// Lever, Greenhouse, and generic HTML — with Shadow DOM, iframes, MutationObserver,
// semantic NLP-style classification, confidence scoring, and human-like typing.
(function () {
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
    const skills = Array.isArray(profile.skills) ? profile.skills.join(", ") : (profile.skills || "");
    const [first, ...rest] = (profile.full_name || "").trim().split(/\s+/);
    const last = rest.join(" ");
    const map = {
      email:      profile.email,
      phone:      profile.phone,
      first_name: first,
      last_name:  last,
      full_name:  profile.full_name,
      linkedin:   profile.linkedin_url,
      github:     profile.github_url,
      portfolio:  profile.portfolio_url || profile.linkedin_url || profile.github_url,
      location:   profile.location,
      company:    profile.current_company || "",
      experience: profile.experience_years ? String(profile.experience_years) : "",
      summary:    profile.cv_summary || profile.bio,
      skills,
      salary:     profile.expected_salary || "",
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
    if (msg?.type === "ARM_SUBMIT_TRACKER") {
      armSubmitTracker(); sendResponse({ ok: true }); return true;
    }
  });

  LOG("Universal autofill engine loaded");
})();
