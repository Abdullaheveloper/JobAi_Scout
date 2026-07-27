/**
 * Part A i18n coverage screenshots (fr or ar) for Voice, Form Fill, Dashboard.
 *
 * Usage:
 *   I18N_BASE_URL=http://localhost:8080 I18N_EMAIL=... I18N_PASSWORD=... I18N_LOCALE=fr node scripts/i18n-coverage-screenshots.mjs
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.I18N_BASE_URL || process.env.RTL_BASE_URL || "http://localhost:8080";
const EMAIL = process.env.I18N_EMAIL || process.env.RTL_EMAIL || "";
const PASSWORD = process.env.I18N_PASSWORD || process.env.RTL_PASSWORD || "";
const LOCALE = process.env.I18N_LOCALE || "fr";
const outDir = join(process.cwd(), "scripts", "i18n-coverage-screenshots");
mkdirSync(outDir, { recursive: true });

const pages = [
  { name: "dashboard", path: "/dashboard" },
  { name: "formfill", path: "/dashboard/auto-fill" },
  { name: "voice", path: "/dashboard/assistant" },
];

async function setLocale(page, locale) {
  await page.addInitScript((lng) => {
    localStorage.setItem("jobai_preferred_locale", lng);
    localStorage.setItem(
      "jobai_cookie_consent",
      JSON.stringify({ accepted: true, timestamp: Date.now() }),
    );
  }, locale);
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"], input[name="email"]', EMAIL);
  await page.fill('input[type="password"], input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 45000 });
}

async function sampleVisibleText(page) {
  return page.evaluate(() => {
    const nodes = [...document.querySelectorAll("h1, h2, button, p")].slice(0, 12);
    return nodes.map((n) => (n.textContent || "").trim()).filter(Boolean);
  });
}

const report = { locale: LOCALE, base: BASE, shots: [], samples: {} };

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
await setLocale(page, LOCALE);

if (!EMAIL || !PASSWORD) {
  console.error("Set I18N_EMAIL / I18N_PASSWORD (or RTL_EMAIL / RTL_PASSWORD) for portal screenshots.");
  process.exitCode = 1;
} else {
  await login(page);
  for (const target of pages) {
    await page.goto(`${BASE}${target.path}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    const file = `${LOCALE}-${target.name}-desktop.png`;
    await page.screenshot({ path: join(outDir, file), fullPage: false });
    report.shots.push(file);
    report.samples[target.name] = await sampleVisibleText(page);
    console.log("shot", file);
  }
}

writeFileSync(join(outDir, "report.json"), JSON.stringify(report, null, 2));
await browser.close();
console.log(`Wrote screenshots to ${outDir}`);
