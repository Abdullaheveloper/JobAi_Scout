/**
 * Quick mobile navbar visibility check at 375 / 390 / 414.
 * Usage: NAV_BASE_URL=http://localhost:8080 node scripts/nav-mobile-check.mjs
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.NAV_BASE_URL || "http://localhost:8080";
const outDir = join(process.cwd(), "scripts", "nav-mobile-screenshots");
mkdirSync(outDir, { recursive: true });

const widths = [375, 390, 414];
const EMAIL = process.env.NAV_EMAIL || process.env.I18N_EMAIL || process.env.RTL_EMAIL || "";
const PASSWORD = process.env.NAV_PASSWORD || process.env.I18N_PASSWORD || process.env.RTL_PASSWORD || "";
const ADMIN_EMAIL = process.env.NAV_ADMIN_EMAIL || process.env.RTL_ADMIN_EMAIL || EMAIL;
const ADMIN_PASSWORD = process.env.NAV_ADMIN_PASSWORD || process.env.RTL_ADMIN_PASSWORD || PASSWORD;
const RECRUITER_EMAIL = process.env.NAV_RECRUITER_EMAIL || process.env.RTL_RECRUITER_EMAIL || "";
const RECRUITER_PASSWORD = process.env.NAV_RECRUITER_PASSWORD || process.env.RTL_RECRUITER_PASSWORD || "";

const publicPages = [
  { name: "landing", path: "/" },
  { name: "login", path: "/login" },
  { name: "about", path: "/about" },
];

const seekerPages = [
  { name: "dashboard", path: "/dashboard" },
  { name: "profile-settings", path: "/dashboard/settings" },
];

const adminPages = [{ name: "admin", path: "/admin" }];
const recruiterPages = [{ name: "recruiter", path: "/recruiter" }];

function overlaps(a, b) {
  return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
}

async function auditNav(page, label) {
  return page.evaluate((pageLabel) => {
    const vw = window.innerWidth;
    const issues = [];
    const nav =
      document.querySelector(".lr-nav") ||
      document.querySelector("header.auth-header") ||
      document.querySelector("nav.nav-premium") ||
      document.querySelector("nav.sticky") ||
      document.querySelector("header.portal-header");

    if (!nav) {
      return { page: pageLabel, vw, ok: false, issues: ["No nav/header found"] };
    }

    const cta =
      nav.querySelector(".nav-primary-cta, a.btn-premium, a[href='/register'].btn, a.auth-link") ||
      nav.querySelector('a[href="/register"]');

    const menuBtn = nav.querySelector(".nav-menu-btn, [aria-label*='menu' i], [aria-label*='Menu']");
    const settingsBtn = nav.querySelector('[aria-label*="Display" i], [aria-label*="settings" i], [aria-label*="عرض" i]');

    const nodes = [cta, menuBtn, settingsBtn].filter(Boolean);
    for (const el of nodes) {
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
        issues.push(`${el.className || el.tagName} not visible`);
        continue;
      }
      if (r.width < 1 || r.height < 1) {
        issues.push(`${el.className || el.tagName} zero size`);
        continue;
      }
      if (r.right > vw + 1 || r.left < -1) {
        issues.push(`${el.className || el.tagName} clipped (left=${r.left.toFixed(1)} right=${r.right.toFixed(1)} vw=${vw})`);
      }
    }

    if (pageLabel === "landing" && cta) {
      const r = cta.getBoundingClientRect();
      if (r.right > vw + 1 || r.left < -1 || r.width < 8) {
        issues.push("Get Started CTA not fully in viewport");
      }
    }

    // pairwise overlap among visible interactive controls in the CTA/right cluster
    const controls = [...nav.querySelectorAll("a, button, [role='button'], [data-radix-select-trigger]")].filter((el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return s.display !== "none" && s.visibility !== "hidden" && r.width > 0 && r.height > 0;
    });

    for (let i = 0; i < controls.length; i++) {
      for (let j = i + 1; j < controls.length; j++) {
        const a = controls[i].getBoundingClientRect();
        const b = controls[j].getBoundingClientRect();
        const overlapX = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
        const overlapY = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        if (overlapX > 4 && overlapY > 4) {
          // nested links (logo) can overlap children — skip parent/child
          if (controls[i].contains(controls[j]) || controls[j].contains(controls[i])) continue;
          issues.push(
            `Overlap: ${controls[i].className || controls[i].tagName} vs ${controls[j].className || controls[j].tagName}`,
          );
        }
      }
    }

    return {
      page: pageLabel,
      vw,
      ok: issues.length === 0,
      issues,
      ctaText: cta?.textContent?.trim()?.slice(0, 40) || null,
      hasMenu: Boolean(menuBtn),
      hasSettings: Boolean(settingsBtn),
    };
  }, label);
}

async function tryLogin(page, email, password) {
  if (!email || !password) return false;
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(400);
  const emailInput = page.locator('input[type="email"]').first();
  const passInput = page.locator('input[type="password"]').first();
  if (!(await emailInput.count()) || !(await passInput.count())) return false;
  await emailInput.fill(email);
  await passInput.fill(password);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(2500);
  return !page.url().includes("/login");
}

async function auditPages(browser, pages, width, report, { email = "", password = "", authLabel = "" } = {}) {
  const context = await browser.newContext({
    viewport: { width, height: 844 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  let authed = false;
  if (email && password) {
    try {
      authed = await tryLogin(page, email, password);
      if (!authed) {
        for (const p of pages) {
          report.push({
            page: p.name,
            vw: width,
            ok: false,
            issues: [`Auth failed for ${authLabel || "user"} — skipped`],
            skippedAuth: true,
          });
          console.log(`SKIP ${p.name}@${width} — auth failed (${authLabel || "user"})`);
        }
        await context.close();
        return;
      }
    } catch (err) {
      for (const p of pages) {
        report.push({ page: p.name, vw: width, ok: false, issues: [`Auth error: ${err.message || err}`], skippedAuth: true });
      }
      await context.close();
      return;
    }
  }

  for (const p of pages) {
    const url = `${BASE}${p.path}`;
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(400);
      const result = await auditNav(page, p.name);
      if (authed) result.authed = true;
      report.push(result);
      const file = `${p.name}-${width}.png`;
      await page.screenshot({ path: join(outDir, file), fullPage: false });
      console.log(
        `${result.ok ? "OK " : "FAIL"} ${p.name}@${width} cta=${result.ctaText} menu=${result.hasMenu} settings=${result.hasSettings}` +
          (result.issues.length ? ` — ${result.issues.join("; ")}` : ""),
      );
    } catch (err) {
      report.push({ page: p.name, vw: width, ok: false, issues: [String(err)] });
      console.error(`ERROR ${p.name}@${width}:`, err.message || err);
    }
  }

  await context.close();
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const report = [];
  const meta = {
    base: BASE,
    authConfigured: Boolean(EMAIL && PASSWORD),
    recruiterConfigured: Boolean(RECRUITER_EMAIL && RECRUITER_PASSWORD),
    gaps: [],
  };

  if (!EMAIL || !PASSWORD) {
    meta.gaps.push("No NAV_/I18N_/RTL_ credentials — Dashboard/Profile/Admin/Recruiter nav checks skipped");
  }
  if (!RECRUITER_EMAIL || !RECRUITER_PASSWORD) {
    meta.gaps.push("No recruiter credentials — Recruiter nav checks skipped");
  }

  for (const width of widths) {
    await auditPages(browser, publicPages, width, report);

    if (EMAIL && PASSWORD) {
      await auditPages(browser, seekerPages, width, report, {
        email: EMAIL,
        password: PASSWORD,
        authLabel: "seeker",
      });
      await auditPages(browser, adminPages, width, report, {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        authLabel: "admin",
      });
    }

    if (RECRUITER_EMAIL && RECRUITER_PASSWORD) {
      await auditPages(browser, recruiterPages, width, report, {
        email: RECRUITER_EMAIL,
        password: RECRUITER_PASSWORD,
        authLabel: "recruiter",
      });
    }
  }

  writeFileSync(join(outDir, "report.json"), JSON.stringify({ meta, results: report }, null, 2));
  const failed = report.filter((r) => !r.ok && !r.skippedAuth);
  console.log(`\nWrote ${outDir}/report.json — ${failed.length} failure(s); gaps: ${meta.gaps.length}`);
  for (const g of meta.gaps) console.log(`GAP: ${g}`);
  await browser.close();
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
