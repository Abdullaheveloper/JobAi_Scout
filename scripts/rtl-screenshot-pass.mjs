/**
 * Part B RTL/bidi verification screenshots (ar + ur, desktop + mobile).
 * Public pages always; portal pages when RTL_EMAIL / RTL_PASSWORD are set.
 *
 * Usage:
 *   node scripts/rtl-screenshot-pass.mjs
 *   RTL_BASE_URL=http://localhost:8080 RTL_EMAIL=... RTL_PASSWORD=... node scripts/rtl-screenshot-pass.mjs
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.RTL_BASE_URL || "http://localhost:8080";
const outDir = join(process.cwd(), "scripts", "rtl-screenshots");
mkdirSync(outDir, { recursive: true });

const publicPages = [
  { name: "landing", path: "/" },
  { name: "login", path: "/login" },
  { name: "register", path: "/register" },
  { name: "forgot", path: "/forgot-password" },
];

/** Auth-gated pages for Part B (user role unless noted). */
const portalPages = [
  { name: "dashboard", path: "/dashboard", role: "user" },
  { name: "formfill", path: "/dashboard/auto-fill", role: "user" },
  { name: "admin-analytics", path: "/admin/analytics", role: "admin" },
  { name: "admin-users", path: "/admin/users", role: "admin" },
];

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

const locales = ["ar", "ur"];

async function shot(page, file) {
  await page.screenshot({ path: join(outDir, file), fullPage: false });
}

async function setLocale(page, locale) {
  await page.addInitScript((lng) => {
    localStorage.setItem("jobai_preferred_locale", lng);
    localStorage.setItem(
      "jobai_cookie_consent",
      JSON.stringify({ accepted: true, timestamp: Date.now() }),
    );
  }, locale);
}

async function bidiChecks(page) {
  return page.evaluate(() => {
    const dir = document.documentElement.getAttribute("dir");
    const lang = document.documentElement.getAttribute("lang");
    const bodyPlain = getComputedStyle(document.body).unicodeBidi;
    const sampleP = document.querySelector("main p, p.text-muted-foreground, p");
    const pPlain = sampleP ? getComputedStyle(sampleP).unicodeBidi : null;

    const sidebar = document.querySelector('[data-sidebar="sidebar"]')?.closest("[data-side]");
    let sidebarSide = sidebar?.getAttribute("data-side") || null;
    let sidebarRect = null;
    const fixed = document.querySelector('[data-side] .fixed, [data-sidebar="sidebar"]');
    const panel =
      document.querySelector('[data-side="right"] > div.fixed') ||
      document.querySelector('[data-side="left"] > div.fixed') ||
      document.querySelector(".group.peer [class*='fixed']");
    if (panel) {
      const r = panel.getBoundingClientRect();
      sidebarRect = { left: r.left, right: r.right, width: r.width };
    }

    const ltrNodes = [...document.querySelectorAll('[dir="ltr"]')].length;
    const autoNodes = [...document.querySelectorAll('[dir="auto"]')].length;

    // Leading punctuation heuristic on visible paragraph text
    const leadingPunct = [];
    for (const el of document.querySelectorAll("p, li, td")) {
      const t = (el.textContent || "").trim();
      if (!t || t.length < 8) continue;
      if (/^[.?!,;:]/.test(t) && /^[.?!,;:].*[A-Za-z]/.test(t)) {
        leadingPunct.push(t.slice(0, 48));
        if (leadingPunct.length >= 5) break;
      }
    }

    const table = document.querySelector("table");
    const tableDir = table?.getAttribute("dir") || (table ? getComputedStyle(table).direction : null);

    return {
      dir,
      lang,
      bodyUnicodeBidi: bodyPlain,
      pUnicodeBidi: pPlain,
      sidebarSide,
      sidebarRect,
      ltrNodes,
      autoNodes,
      leadingPunctSamples: leadingPunct,
      tableDir,
      viewportWidth: window.innerWidth,
    };
  });
}

async function tryLogin(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(600);
  const emailInput = page.locator('input[type="email"], input[name="email"]').first();
  const passInput = page.locator('input[type="password"]').first();
  if (!(await emailInput.count()) || !(await passInput.count())) return false;
  await emailInput.fill(email);
  await passInput.fill(password);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(2500);
  return !page.url().includes("/login");
}

const browser = await chromium.launch({ headless: true });
const report = { base: BASE, shots: [], checks: [], gaps: [] };
const email = process.env.RTL_EMAIL || "";
const password = process.env.RTL_PASSWORD || "";
const adminEmail = process.env.RTL_ADMIN_EMAIL || email;
const adminPassword = process.env.RTL_ADMIN_PASSWORD || password;

for (const locale of locales) {
  for (const vp of viewports) {
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width: vp.width, height: vp.height },
      locale: locale === "ur" ? "ur-PK" : "ar-SA",
      colorScheme: "dark",
    });
    const page = await context.newPage();
    await setLocale(page, locale);

    for (const p of publicPages) {
      try {
        await page.goto(`${BASE}${p.path}`, { waitUntil: "domcontentloaded", timeout: 45000 });
        await page.waitForTimeout(900);
        const file = `${locale}-${p.name}-${vp.name}.png`;
        await shot(page, file);
        const checks = await bidiChecks(page);
        report.shots.push(file);
        report.checks.push({ file, ...checks, ok: checks.dir === "rtl" });
        console.log(`${file}: dir=${checks.dir} lang=${checks.lang} punct=${checks.leadingPunctSamples.length}`);
      } catch (e) {
        report.checks.push({ page: p.name, vp: vp.name, locale, error: String(e) });
        console.error(`FAIL ${locale} ${p.name} ${vp.name}:`, e.message);
      }
    }

    const creds = { user: { email, password }, admin: { email: adminEmail, password: adminPassword } };
    let loggedInRole = null;

    for (const p of portalPages) {
      const c = creds[p.role === "admin" ? "admin" : "user"];
      if (!c.email || !c.password) {
        report.gaps.push(`Skipped ${locale}-${p.name}-${vp.name}: set RTL_EMAIL/RTL_PASSWORD (and RTL_ADMIN_* for admin)`);
        continue;
      }
      try {
        if (loggedInRole !== p.role) {
          await context.clearCookies();
          await setLocale(page, locale);
          const ok = await tryLogin(page, c.email, c.password);
          if (!ok) {
            report.gaps.push(`Login failed for ${p.role} (${locale}/${vp.name})`);
            continue;
          }
          loggedInRole = p.role;
        }
        await page.goto(`${BASE}${p.path}`, { waitUntil: "domcontentloaded", timeout: 45000 });
        await page.waitForTimeout(1200);
        const file = `${locale}-${p.name}-${vp.name}.png`;
        await shot(page, file);
        const checks = await bidiChecks(page);
        const sidebarOk =
          !checks.sidebarRect ||
          (checks.sidebarSide === "right" &&
            checks.sidebarRect.right > checks.viewportWidth - 8);
        report.shots.push(file);
        report.checks.push({
          file,
          ...checks,
          ok: checks.dir === "rtl" && sidebarOk,
          sidebarOk,
        });
        console.log(
          `${file}: dir=${checks.dir} side=${checks.sidebarSide} sidebarOk=${sidebarOk} tableDir=${checks.tableDir}`,
        );
      } catch (e) {
        report.checks.push({ page: p.name, vp: vp.name, locale, error: String(e) });
        console.error(`FAIL portal ${locale} ${p.name}:`, e.message);
      }
    }

    await context.close();
  }
}

writeFileSync(join(outDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
await browser.close();
console.log(`Wrote ${report.shots.length} screenshots to ${outDir}`);
if (report.gaps.length) {
  console.log("Gaps:");
  for (const g of report.gaps) console.log(`  - ${g}`);
}
