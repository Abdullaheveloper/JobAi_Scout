/**
 * Locale-render proof screenshots for Part A (no auth required).
 * Renders the exact locale JSON strings that VoiceMode / AutoFormFill / Dashboard t() keys use.
 *
 * Usage:
 *   node scripts/i18n-coverage-locale-proof.mjs           # fr (default)
 *   node scripts/i18n-coverage-locale-proof.mjs fr
 *   node scripts/i18n-coverage-locale-proof.mjs ar
 *   node scripts/i18n-coverage-locale-proof.mjs ur
 *   node scripts/i18n-coverage-locale-proof.mjs ar ur fr  # multiple
 */
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const outDir = join(process.cwd(), "scripts", "i18n-coverage-screenshots");
mkdirSync(outDir, { recursive: true });

const RTL = new Set(["ar", "ur"]);
const args = process.argv.slice(2).filter(Boolean);
const locales = args.length ? args : ["fr"];

function esc(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildPages(L) {
  return [
    {
      name: "voice",
      html: `<main style="font-family:system-ui;padding:32px;background:#0f172a;color:#e2e8f0;min-height:100vh">
      <p style="letter-spacing:.2em;text-transform:uppercase;font-size:11px;color:#a5b4fc">${esc(L.voice.brand)}</p>
      <h1>${esc(L.voice.title)}</h1>
      <h2>${esc(L.voice.state.idle.title)}</h2>
      <p>${esc(L.voice.state.idle.detail)}</p>
      <p>${esc(L.voice.state.ended.title)} — ${esc(L.voice.state.ended.detail)}</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin:20px 0">
        <button>${esc(L.voice.startAssistant)}</button>
        <button>${esc(L.voice.stopListening)}</button>
        <button>${esc(L.voice.stopSpeaking)}</button>
        <button>${esc(L.voice.endAssistant)}</button>
      </div>
      <p>${esc(L.voice.silenceHint)}</p>
    </main>`,
    },
    {
      name: "formfill",
      html: `<main style="font-family:system-ui;padding:32px;background:#fff;color:#0f172a;min-height:100vh">
      <h1>${esc(L.formFill.title)}</h1>
      <p>${esc(L.formFill.subtitle)}</p>
      <button style="padding:12px 16px;margin:16px 0">${esc(L.formFill.downloadExtension)}</button>
      <h2>${esc(L.formFill.installTitle)}</h2>
      <ol>
        <li><b>${esc(L.formFill.step1Title)}</b> — ${esc(L.formFill.step1Desc)}</li>
        <li><b>${esc(L.formFill.step2Title)}</b> — ${esc(L.formFill.step2Desc)}</li>
        <li><b>${esc(L.formFill.step3Title)}</b> — ${esc(L.formFill.step3Desc)}</li>
      </ol>
      <h2>${esc(L.formFill.dataTitle)}</h2>
      <p>${esc(L.formFill.dataSubtitle)}</p>
    </main>`,
    },
    {
      name: "dashboard",
      html: `<main style="font-family:system-ui;padding:32px;background:#0b1220;color:#e2e8f0;min-height:100vh">
      <p>${esc(L.dashboard.greetingMorning)}</p>
      <h1>${esc(L.dashboard.welcomeBack)}</h1>
      <p>${esc(L.brand.tagline)}</p>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:20px 0">
        <div><b>${esc(L.dashboard.skillsDetected)}</b><div>${esc(L.dashboard.fromCvAnalysis)}</div></div>
        <div><b>${esc(L.dashboard.suggestedRoles)}</b><div>${esc(L.dashboard.aiRecommended)}</div></div>
        <div><b>${esc(L.dashboard.profileScore)}</b><div>${esc(L.dashboard.readyForMatching)}</div></div>
        <div><b>${esc(L.dashboard.aiMatches)}</b><div>${esc(L.dashboard.jobsMatching)}</div></div>
      </div>
      <h3>${esc(L.dashboard.yourSkills)}</h3>
      <h3>${esc(L.dashboard.yourRoles)}</h3>
      <a>${esc(L.dashboard.browseMatchingJobs)}</a>
      <h2>${esc(L.dashboard.quickActions)}</h2>
      <ul>
        <li>${esc(L.dashboard.uploadCvTitle)}</li>
        <li>${esc(L.dashboard.browseJobsTitle)}</li>
        <li>${esc(L.dashboard.automationTitle)}</li>
        <li>${esc(L.dashboard.savedJobsTitle)}</li>
        <li>${esc(L.dashboard.voiceTitle)}</li>
        <li>${esc(L.dashboard.formFillTitle)}</li>
      </ul>
    </main>`,
    },
  ];
}

const reportPath = join(outDir, "report.json");
let report = {
  locales: [],
  mode: "locale-render-proof",
  note: "Rendered from locale JSON keys used by VoiceMode/AutoFormFill/Dashboard. Live portal screenshots need I18N_EMAIL/I18N_PASSWORD (see i18n-coverage-screenshots.mjs).",
  shots: [],
};
if (existsSync(reportPath)) {
  try {
    const prev = JSON.parse(readFileSync(reportPath, "utf8"));
    if (Array.isArray(prev.shots)) report.shots = [...prev.shots];
    if (Array.isArray(prev.locales)) report.locales = [...prev.locales];
    else if (prev.locale) report.locales = [prev.locale];
  } catch {
    /* fresh report */
  }
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

for (const locale of locales) {
  const localePath = join(process.cwd(), "src", "locales", `${locale}.json`);
  if (!existsSync(localePath)) {
    console.error(`Missing locale file: ${localePath}`);
    process.exitCode = 1;
    continue;
  }
  const L = JSON.parse(readFileSync(localePath, "utf8"));
  const dir = RTL.has(locale) ? "rtl" : "ltr";
  const pages = buildPages(L);

  if (!report.locales.includes(locale)) report.locales.push(locale);

  for (const target of pages) {
    const wrapped = `<!DOCTYPE html><html lang="${locale}" dir="${dir}"><head><meta charset="utf-8"></head><body style="margin:0">${target.html}</body></html>`;
    await page.setContent(wrapped, { waitUntil: "domcontentloaded" });
    const file = `${locale}-${target.name}-desktop.png`;
    await page.screenshot({ path: join(outDir, file), fullPage: false });
    if (!report.shots.includes(file)) report.shots.push(file);
    console.log("wrote", file, `(dir=${dir})`);
  }

  console.log(`\n[${locale}] sample strings:`);
  console.log("  voice.title:", L.voice?.title);
  console.log("  voice.startAssistant:", L.voice?.startAssistant);
  console.log("  formFill.title:", L.formFill?.title);
  console.log("  formFill.downloadExtension:", L.formFill?.downloadExtension);
}

report.note =
  "Rendered from locale JSON keys used by VoiceMode/AutoFormFill/Dashboard. Live portal screenshots need I18N_EMAIL/I18N_PASSWORD (see i18n-coverage-screenshots.mjs).";
writeFileSync(reportPath, JSON.stringify(report, null, 2));
await browser.close();
console.log(`\nWrote screenshots to ${outDir}`);
console.log("report.json shots:", report.shots.length);
