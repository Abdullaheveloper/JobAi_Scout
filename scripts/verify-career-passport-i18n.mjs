/**
 * Verification A: Career Passport + Profile contact form i18n screenshots (hi/ur/ar).
 * Prefers live authenticated Profile Settings when I18N_/RTL_ credentials exist;
 * otherwise renders locale-proof HTML from the same t() keys the UI uses.
 *
 * Usage:
 *   node scripts/verify-career-passport-i18n.mjs
 *   I18N_BASE_URL=http://localhost:8080 I18N_EMAIL=... I18N_PASSWORD=... node scripts/verify-career-passport-i18n.mjs
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.I18N_BASE_URL || process.env.RTL_BASE_URL || process.env.NAV_BASE_URL || "http://localhost:8080";
const EMAIL = process.env.I18N_EMAIL || process.env.RTL_EMAIL || "";
const PASSWORD = process.env.I18N_PASSWORD || process.env.RTL_PASSWORD || "";
const locales = ["hi", "ur", "ar"];
const RTL = new Set(["ar", "ur"]);
const outDir = join(process.cwd(), "scripts", "verify-career-passport-i18n");
mkdirSync(outDir, { recursive: true });

function getByPath(obj, path) {
  return path.split(".").reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function looksEnglish(text) {
  const t = String(text || "").trim();
  if (!t) return false;
  // ASCII letters dominate and common English UI words appear
  const letters = t.replace(/[^A-Za-z\u0900-\u097F\u0600-\u06FF]/g, "");
  if (!letters) return false;
  const ascii = (letters.match(/[A-Za-z]/g) || []).length;
  const ratio = ascii / letters.length;
  if (ratio < 0.55) return false;
  // Allow brand / technical tokens
  if (/^(JobAI|CAPTCHA|URL|GPA|ATS|LinkedIn|GitHub|JPG|PNG|WEBP|MB|AI)$/i.test(t)) return false;
  return /[A-Za-z]{3,}/.test(t);
}

const CONTACT_KEYS = [
  "settings.contactBackground",
  "settings.personalDesc",
  "settings.fullName",
  "settings.email",
  "settings.emailLocked",
  "settings.phone",
  "settings.location",
  "settings.experienceYears",
  "settings.currentCompany",
  "settings.expectedSalary",
  "settings.education",
  "settings.bio",
  "settings.profileImage",
  "settings.profileImageHint",
  "settings.uploadImage",
  "settings.saveChanges",
  "settings.locationHint",
  "settings.salaryHint",
  "settings.educationHint",
];

const PASSPORT_KEYS = [
  "careerPassport.title",
  "careerPassport.subtitle",
  "careerPassport.workExperience",
  "careerPassport.workExperienceDesc",
  "careerPassport.addRole",
  "careerPassport.emptyExperienceTitle",
  "careerPassport.emptyExperienceDesc",
  "careerPassport.education",
  "careerPassport.educationDesc",
  "careerPassport.addEducation",
  "careerPassport.emptyEducationTitle",
  "careerPassport.projects",
  "careerPassport.projectsDesc",
  "careerPassport.addProject",
  "careerPassport.credentialsRecognition",
  "careerPassport.credentialsRecognitionDesc",
  "careerPassport.emptyCredentialsTitle",
  "careerPassport.references",
  "careerPassport.referencesDesc",
  "careerPassport.professionalLinks",
  "careerPassport.matchingEssentials",
  "careerPassport.credentials",
  "careerPassport.applicationAutofill",
  "careerPassport.alwaysManualPrefix",
  "careerPassport.alwaysManualBody",
  "careerPassport.fields.jobTitle",
  "careerPassport.fields.company",
  "careerPassport.fields.skills",
  "careerPassport.fields.certifications",
  "careerPassport.fields.linkedinUrl",
  "careerPassport.fields.githubUrl",
  "careerPassport.fields.portfolioUrl",
  "settings.autofillHint",
  "settings.skillsHint",
  "settings.extensionAutofillHint",
  "settings.additionalDesc",
  "settings.desiredRoles",
];

function buildProofHtml(L, locale) {
  const t = (key, vars = {}) => {
    let v = getByPath(L, key);
    if (v == null) return `MISSING:${key}`;
    return String(v).replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : `{{${k}}}`));
  };
  const dir = RTL.has(locale) ? "rtl" : "ltr";
  const field = (label, placeholder) =>
    `<label style="display:block;margin:10px 0 4px;font-weight:600">${esc(label)}</label>
     <input style="width:100%;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px" placeholder="${esc(placeholder || "")}" />`;

  return `<!doctype html><html lang="${locale}" dir="${dir}"><head><meta charset="utf-8"/>
  <style>
    body{font-family:system-ui,Segoe UI,Tahoma,sans-serif;margin:0;background:#f8fafc;color:#0f172a}
    .wrap{max-width:920px;margin:0 auto;padding:28px}
    .card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:20px;margin:18px 0}
    h1{font-size:28px;margin:0 0 8px} h2{font-size:18px;margin:0 0 6px}
    .muted{color:#64748b;font-size:14px;line-height:1.5}
    .row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .warn{margin-top:16px;border-radius:12px;border:1px solid rgba(217,119,6,.35);background:#fef3c7;color:#451a03;padding:12px 14px;font-size:14px;line-height:1.6}
    .badge{display:inline-block;background:#eef2ff;color:#3730a3;padding:4px 10px;border-radius:999px;font-size:12px;margin-bottom:10px}
    @media(max-width:700px){.row{grid-template-columns:1fr}}
  </style></head><body><div class="wrap">
  <div class="badge">${esc(locale.toUpperCase())} locale-proof · Profile Settings keys</div>

  <section class="card" id="contact">
    <h1>${esc(t("settings.contactBackground"))}</h1>
    <p class="muted">${esc(t("settings.personalDesc"))}</p>
    <div class="row">
      <div>${field(t("settings.fullName"), t("settings.placeholderName"))}</div>
      <div>${field(t("settings.email"), t("settings.emailLocked"))}</div>
      <div>${field(t("settings.phone"), t("settings.placeholderPhone"))}</div>
      <div>${field(t("settings.location"), t("settings.placeholderLocation"))}</div>
      <div>${field(t("settings.experienceYears"), "")}</div>
      <div>${field(t("settings.currentCompany"), t("settings.placeholderCompany"))}</div>
      <div>${field(t("settings.expectedSalary"), t("settings.placeholderSalary"))}</div>
      <div>${field(t("settings.education"), t("settings.placeholderEducation"))}</div>
    </div>
    <div>${field(t("settings.bio"), t("settings.placeholderBio"))}</div>
  </section>

  <section class="card" id="passport">
    <h1>${esc(t("careerPassport.title"))}</h1>
    <p class="muted">${esc(t("careerPassport.subtitle"))}</p>
    <p class="muted">${esc(t("careerPassport.verifiedEntries", { count: 3 }))}</p>

    <h2>${esc(t("careerPassport.workExperience"))}</h2>
    <p class="muted">${esc(t("careerPassport.workExperienceDesc"))}</p>
    <button>${esc(t("careerPassport.addRole"))}</button>
    <p><b>${esc(t("careerPassport.emptyExperienceTitle"))}</b> — ${esc(t("careerPassport.emptyExperienceDesc"))}</p>

    <h2>${esc(t("careerPassport.education"))}</h2>
    <p class="muted">${esc(t("careerPassport.educationDesc"))}</p>
    <button>${esc(t("careerPassport.addEducation"))}</button>

    <h2>${esc(t("careerPassport.projects"))}</h2>
    <p class="muted">${esc(t("careerPassport.projectsDesc"))}</p>
    <button>${esc(t("careerPassport.addProject"))}</button>

    <h2>${esc(t("careerPassport.credentialsRecognition"))}</h2>
    <p class="muted">${esc(t("careerPassport.credentialsRecognitionDesc"))}</p>
    <p><b>${esc(t("careerPassport.emptyCredentialsTitle"))}</b> — ${esc(t("careerPassport.emptyCredentialsDesc"))}</p>

    <h2>${esc(t("careerPassport.references"))}</h2>
    <p class="muted">${esc(t("careerPassport.referencesDesc"))}</p>

    <h2>${esc(t("careerPassport.professionalLinks"))}</h2>
    <p class="muted">${esc(t("settings.extensionAutofillHint"))}</p>
    ${field(t("careerPassport.fields.linkedinUrl"), t("settings.placeholderLinkedin"))}
    ${field(t("careerPassport.fields.githubUrl"), t("settings.placeholderGithub"))}

    <h2>${esc(t("careerPassport.matchingEssentials"))}</h2>
    <p class="muted">${esc(t("settings.skillsHint"))}</p>
    ${field(t("careerPassport.fields.skills"), t("settings.placeholderSkills"))}

    <h2>${esc(t("careerPassport.credentials"))}</h2>
    <p class="muted">${esc(t("settings.additionalDesc"))}</p>
    ${field(t("careerPassport.fields.certifications"), t("settings.placeholderCerts"))}

    <h2>${esc(t("careerPassport.applicationAutofill"))}</h2>
    <p class="muted">${esc(t("settings.autofillHint"))}</p>
    <div class="warn"><strong>${esc(t("careerPassport.alwaysManualPrefix"))}</strong> ${esc(t("careerPassport.alwaysManualBody"))}</div>
  </section>
  </div></body></html>`;
}

function auditKeys(L, keys) {
  const english = [];
  const missing = [];
  for (const key of keys) {
    const val = getByPath(L, key);
    if (val == null || val === "") missing.push(key);
    else if (looksEnglish(val)) english.push({ key, value: String(val).slice(0, 120) });
  }
  return { english, missing };
}

async function tryLive(page, locale) {
  await page.addInitScript((lng) => {
    localStorage.setItem("jobai_preferred_locale", lng);
    localStorage.setItem("jobai_cookie_consent", JSON.stringify({ accepted: true, timestamp: Date.now() }));
  }, locale);
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);
  if (page.url().includes("/login")) return { ok: false, reason: "login failed or still on /login" };
  await page.goto(`${BASE}/dashboard/settings`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(1200);
  return { ok: true };
}

const report = {
  mode: EMAIL && PASSWORD ? "live-preferred" : "locale-proof-only",
  base: BASE,
  authConfigured: Boolean(EMAIL && PASSWORD),
  locales: {},
  shots: [],
  gaps: [],
};

const browser = await chromium.launch({ headless: true });

for (const locale of locales) {
  const localePath = join(process.cwd(), "src", "locales", `${locale}.json`);
  if (!existsSync(localePath)) {
    report.gaps.push(`Missing locale file ${locale}`);
    continue;
  }
  const L = JSON.parse(readFileSync(localePath, "utf8"));
  const contactAudit = auditKeys(L, CONTACT_KEYS);
  const passportAudit = auditKeys(L, PASSPORT_KEYS);
  // Placeholders are UI chrome for empty fields — flag English ones separately
  const placeholderKeys = [
    "settings.placeholderName",
    "settings.placeholderPhone",
    "settings.placeholderLocation",
    "settings.placeholderCompany",
    "settings.placeholderSalary",
    "settings.placeholderEducation",
    "settings.placeholderBio",
    "settings.placeholderSkills",
    "settings.placeholderRoles",
    "settings.placeholderCerts",
    "settings.placeholderLanguages",
  ];
  const placeholderAudit = auditKeys(L, placeholderKeys);

  const entry = {
    contactEnglishChrome: contactAudit.english,
    passportEnglishChrome: passportAudit.english,
    missing: [...contactAudit.missing, ...passportAudit.missing],
    placeholderEnglish: placeholderAudit.english,
    live: null,
    proofShots: [],
  };

  // Locale-proof screenshots (always)
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: locale === "hi" ? "hi-IN" : locale === "ur" ? "ur-PK" : "ar-SA",
  });
  const page = await context.newPage();
  const html = buildProofHtml(L, locale);
  await page.setContent(html, { waitUntil: "domcontentloaded" });

  const contactFile = `${locale}-contact-proof.png`;
  const passportFile = `${locale}-career-passport-proof.png`;
  await page.locator("#contact").screenshot({ path: join(outDir, contactFile) });
  await page.locator("#passport").screenshot({ path: join(outDir, passportFile) });
  entry.proofShots.push(contactFile, passportFile);
  report.shots.push(contactFile, passportFile);
  console.log("proof", contactFile, passportFile);

  // Full-page proof
  const fullFile = `${locale}-profile-settings-proof-full.png`;
  await page.screenshot({ path: join(outDir, fullFile), fullPage: true });
  entry.proofShots.push(fullFile);
  report.shots.push(fullFile);

  if (EMAIL && PASSWORD) {
    try {
      const liveCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const livePage = await liveCtx.newPage();
      const live = await tryLive(livePage, locale);
      entry.live = live;
      if (live.ok) {
        const liveFile = `${locale}-profile-settings-live.png`;
        await livePage.screenshot({ path: join(outDir, liveFile), fullPage: true });
        entry.proofShots.push(liveFile);
        report.shots.push(liveFile);
        console.log("live", liveFile);
      } else {
        report.gaps.push(`${locale} live Profile Settings blocked: ${live.reason}`);
      }
      await liveCtx.close();
    } catch (err) {
      entry.live = { ok: false, reason: String(err.message || err) };
      report.gaps.push(`${locale} live screenshot error: ${err.message || err}`);
    }
  } else {
    report.gaps.push("No I18N_EMAIL/I18N_PASSWORD (or RTL_*) — live Profile Settings screenshots skipped");
  }

  // Pass criteria: careerPassport chrome translated; contact labels/titles translated.
  // Placeholders counted as soft gap (still English UI chrome).
  const hardEnglish = [...contactAudit.english, ...passportAudit.english];
  entry.pass = hardEnglish.length === 0 && entry.missing.length === 0;
  entry.hardEnglishCount = hardEnglish.length;
  report.locales[locale] = entry;
  await context.close();
}

// Dedupe gaps note about credentials
report.gaps = [...new Set(report.gaps)];

writeFileSync(join(outDir, "report.json"), JSON.stringify(report, null, 2));
await browser.close();

const failed = Object.entries(report.locales).filter(([, v]) => !v.pass);
console.log(`\nWrote ${outDir}/report.json — ${failed.length} locale hard-fail(s)`);
for (const [loc, v] of Object.entries(report.locales)) {
  console.log(
    `${v.pass ? "PASS" : "FAIL"} ${loc}: hardEnglish=${v.hardEnglishCount} missing=${v.missing.length} placeholderEnglish=${v.placeholderEnglish.length}`,
  );
  for (const e of [...v.contactEnglishChrome, ...v.passportEnglishChrome].slice(0, 12)) {
    console.log(`  EN ${e.key}: ${e.value}`);
  }
}
process.exitCode = failed.length ? 1 : 0;
