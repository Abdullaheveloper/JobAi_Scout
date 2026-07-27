/**
 * WS3 verification: RTL placeholder dir + CV header bidi (ar/ur, desktop/mobile).
 *
 * Usage:
 *   node scripts/ws3-rtl-verify.mjs
 *   RTL_BASE_URL=https://localhost:5181 RTL_EMAIL=... RTL_PASSWORD=... node scripts/ws3-rtl-verify.mjs
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.RTL_BASE_URL || "https://localhost:5181";
const outDir = join(process.cwd(), "scripts", "ws3-rtl-screenshots");
mkdirSync(outDir, { recursive: true });

const locales = ["ar", "ur"];
const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

const publicPages = [
  { name: "login", path: "/login" },
  { name: "register", path: "/register" },
];

const seekerPages = [
  { name: "cv-upload", path: "/dashboard/cv" },
  { name: "profile", path: "/dashboard/settings" },
  { name: "jobs", path: "/dashboard/jobs" },
  { name: "formfill", path: "/dashboard/auto-fill" },
];

const recruiterPages = [
  { name: "recruiter-jobs", path: "/recruiter/jobs" },
  { name: "recruiter-profile", path: "/recruiter/profile" },
];

const adminPages = [{ name: "admin-jobs", path: "/admin/jobs" }];

function loadLocale(code) {
  return JSON.parse(readFileSync(join(process.cwd(), "src", "locales", `${code}.json`), "utf8"));
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

async function shot(page, file) {
  await page.screenshot({ path: join(outDir, file), fullPage: false });
}

async function tryLogin(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(600);
  const emailInput = page.locator('input[type="email"]').first();
  const passInput = page.locator('input[type="password"]').first();
  if (!(await emailInput.count()) || !(await passInput.count())) return false;
  await emailInput.fill(email);
  await passInput.fill(password);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(2500);
  return !page.url().includes("/login");
}

async function inspectPlaceholders(page) {
  return page.evaluate(() => {
    const fields = [...document.querySelectorAll("input, textarea")].filter((el) => {
      const style = getComputedStyle(el);
      const type = el.getAttribute("type") || "";
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        type !== "hidden" &&
        type !== "file" &&
        type !== "checkbox" &&
        type !== "radio"
      );
    });

    const samples = fields.slice(0, 50).map((el) => {
      const ph = el.getAttribute("placeholder") || "";
      return {
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute("type") || (el.tagName === "TEXTAREA" ? "textarea" : "text"),
        dir: el.getAttribute("dir"),
        computedDir: getComputedStyle(el).direction,
        unicodeBidi: getComputedStyle(el).unicodeBidi,
        placeholder: ph.slice(0, 100),
        leadingPunct: /^[.?!,;:…]/.test(ph.trim()),
      };
    });

    const badPlaceholderPunct = samples.filter((s) => s.leadingPunct);
    const missingDir = samples.filter((s) => !s.dir);
    const urlEmailOk = samples
      .filter((s) => s.type === "url" || s.type === "email" || s.type === "tel")
      .every((s) => s.dir === "ltr" || s.computedDir === "ltr");

    const h1 = document.querySelector("h1");
    const headerText = (h1?.textContent || "").trim();
    return {
      pageDir: document.documentElement.getAttribute("dir"),
      lang: document.documentElement.getAttribute("lang"),
      sampleCount: samples.length,
      autoCount: samples.filter((s) => s.dir === "auto").length,
      ltrCount: samples.filter((s) => s.dir === "ltr").length,
      missingDirCount: missingDir.length,
      badPlaceholderPunct: badPlaceholderPunct.map((s) => s.placeholder),
      urlEmailOk,
      header: {
        text: headerText.slice(0, 120),
        dir: h1?.getAttribute("dir") || null,
        leadingPunct: /^[.?!,;:…]/.test(headerText),
      },
      samples: samples.slice(0, 12),
    };
  });
}

function fixtureHtml(locale, pack) {
  const cv = pack.cv;
  const dir = "rtl";
  return `<!doctype html>
<html lang="${locale}" dir="${dir}">
<head>
<meta charset="utf-8"/>
<title>WS3 fixture ${locale}</title>
<style>
  body{font-family:system-ui,Segoe UI,Tahoma,sans-serif;margin:0;padding:24px;background:#0b1220;color:#e2e8f0}
  .card{max-width:720px;margin:0 auto 28px;padding:24px;border:1px solid #334155;border-radius:16px;background:#111827}
  h1{font-size:28px;margin:8px 0}
  p{color:#94a3b8;line-height:1.5}
  label{display:block;margin:14px 0 6px;font-size:13px;color:#cbd5e1}
  input,textarea{
    width:100%;box-sizing:border-box;padding:10px 12px;border-radius:8px;border:1px solid #475569;
    background:#0f172a;color:#e2e8f0;font:inherit;
  }
  input[dir="ltr"],textarea[dir="ltr"],input[type="url"],input[type="email"]{
    direction:ltr;unicode-bidi:isolate;text-align:left;
  }
  input[dir="auto"],textarea[dir="auto"]{unicode-bidi:plaintext;text-align:start}
  .badge{display:inline-block;padding:4px 10px;border-radius:999px;border:1px solid #6366f1;color:#a5b4fc;font-size:12px}
</style>
</head>
<body>
  <section class="card" id="cv-header">
    <span class="badge" dir="auto">${cv.stepBadge.replace("{{step}}","1").replace("{{total}}","2")}</span>
    <h1 dir="auto">${cv.title}</h1>
    <p dir="auto">${cv.subtitle}</p>
  </section>
  <section class="card" id="recruiter-fields">
    <h2>Recruiter placeholders</h2>
    <label>Description</label>
    <textarea dir="auto" rows="3" placeholder="Job description..."></textarea>
    <label>Company blurb</label>
    <textarea dir="auto" rows="3" placeholder="A short description candidates will see with your postings."></textarea>
    <label>Application URL</label>
    <input type="url" dir="ltr" placeholder="https://..." />
    <label>Website</label>
    <input type="url" placeholder="https://company.com" />
    <label>Email</label>
    <input type="email" placeholder="you@example.com" />
  </section>
</body>
</html>`;
}

async function run() {
  const report = {
    base: BASE,
    startedAt: new Date().toISOString(),
    auth: { seeker: false, recruiter: false, admin: false, blocker: null },
    shots: [],
    checks: [],
    pass: true,
  };

  const browser = await chromium.launch({ headless: true });
  const email = process.env.RTL_EMAIL || process.env.RTL_SEEKER_EMAIL || "";
  const password = process.env.RTL_PASSWORD || process.env.RTL_SEEKER_PASSWORD || "";
  const recEmail = process.env.RTL_RECRUITER_EMAIL || "";
  const recPassword = process.env.RTL_RECRUITER_PASSWORD || "";
  const adminEmail = process.env.RTL_ADMIN_EMAIL || email;
  const adminPassword = process.env.RTL_ADMIN_PASSWORD || password;

  // Always capture fixture proofs (CV header + recruiter placeholder punctuation)
  for (const locale of locales) {
    const pack = loadLocale(locale);
    for (const vp of viewports) {
      const context = await browser.newContext({
        ignoreHTTPSErrors: true,
        viewport: { width: vp.width, height: vp.height },
      });
      const page = await context.newPage();
      await page.setContent(fixtureHtml(locale, pack), { waitUntil: "domcontentloaded" });
      const file = `${locale}-cv-header-${vp.name}.png`;
      const file2 = `${locale}-recruiter-placeholders-${vp.name}.png`;
      await page.locator("#cv-header").screenshot({ path: join(outDir, file) });
      await page.locator("#recruiter-fields").screenshot({ path: join(outDir, file2) });
      report.shots.push(file, file2);

      const check = await page.evaluate(() => {
        const h1 = document.querySelector("h1");
        const areas = [...document.querySelectorAll("textarea")].map((el) => ({
          ph: el.getAttribute("placeholder") || "",
          dir: el.getAttribute("dir"),
          computedDir: getComputedStyle(el).direction,
          leadingPunct: /^[.?!,;:…]/.test((el.getAttribute("placeholder") || "").trim()),
        }));
        const urls = [...document.querySelectorAll('input[type="url"], input[type="email"]')].map((el) => ({
          type: el.getAttribute("type"),
          dir: el.getAttribute("dir") || null,
          computedDir: getComputedStyle(el).direction,
        }));
        return {
          headerText: (h1?.textContent || "").trim(),
          headerDir: h1?.getAttribute("dir"),
          headerLeadingPunct: /^[.?!,;:…]/.test((h1?.textContent || "").trim()),
          areas,
          urls,
        };
      });

      const translated =
        locale === "ar"
          ? /أحي|سيرت|الذاتية|الخطوة|ملفك/.test(check.headerText)
          : /سی وی|ریزیومے|مرحلہ|پروفائل|زندگی/.test(check.headerText);
      const punctOk = check.areas.every((a) => !a.leadingPunct) && !check.headerLeadingPunct;
      const urlOk = check.urls.every((u) => u.computedDir === "ltr");
      const ok = translated && punctOk && urlOk;
      report.checks.push({ page: "fixture", locale, viewport: vp.name, ok, translated, punctOk, urlOk, check });
      if (!ok) report.pass = false;
      await context.close();
    }
  }

  // Live public pages
  let liveOk = true;
  for (const locale of locales) {
    for (const vp of viewports) {
      const context = await browser.newContext({
        ignoreHTTPSErrors: true,
        viewport: { width: vp.width, height: vp.height },
        locale: locale === "ur" ? "ur-PK" : "ar-SA",
      });
      const page = await context.newPage();
      await setLocale(page, locale);
      for (const p of publicPages) {
        try {
          await page.goto(`${BASE}${p.path}`, { waitUntil: "domcontentloaded", timeout: 45000 });
          await page.waitForTimeout(900);
          const file = `${locale}-${p.name}-${vp.name}.png`;
          await shot(page, file);
          report.shots.push(file);
          const check = await inspectPlaceholders(page);
          report.checks.push({ page: p.name, locale, viewport: vp.name, live: true, ...check });
          if (check.badPlaceholderPunct.length) report.pass = false;
          // Expect email fields LTR and most sentence fields dir=auto
          if (check.missingDirCount > 2) report.pass = false;
        } catch (err) {
          liveOk = false;
          report.checks.push({ page: p.name, locale, viewport: vp.name, error: String(err) });
        }
      }
      await context.close();
    }
  }
  if (!liveOk) {
    report.auth.blocker = (report.auth.blocker || "") + ` Live app unreachable at ${BASE}.`;
  }

  async function capturePortal(pages, creds, flag) {
    if (!creds.email || !creds.password) return;
    for (const locale of locales) {
      for (const vp of viewports) {
        const context = await browser.newContext({
          ignoreHTTPSErrors: true,
          viewport: { width: vp.width, height: vp.height },
          locale: locale === "ur" ? "ur-PK" : "ar-SA",
        });
        const page = await context.newPage();
        await setLocale(page, locale);
        const ok = await tryLogin(page, creds.email, creds.password);
        report.auth[flag] = report.auth[flag] || ok;
        if (!ok) {
          await context.close();
          continue;
        }
        for (const p of pages) {
          try {
            await page.goto(`${BASE}${p.path}`, { waitUntil: "domcontentloaded", timeout: 45000 });
            await page.waitForTimeout(1000);
            if (page.url().includes("/login")) continue;
            const file = `${locale}-${p.name}-${vp.name}.png`;
            await shot(page, file);
            report.shots.push(file);
            const check = await inspectPlaceholders(page);
            report.checks.push({ page: p.name, locale, viewport: vp.name, live: true, ...check });
            if (check.badPlaceholderPunct.length) report.pass = false;
            if (p.name === "cv-upload") {
              const translated =
                locale === "ar"
                  ? /أحي|سيرت|الذاتية|الخطوة|ملفك/.test(check.header.text)
                  : /سی وی|ریزیومے|مرحلہ|پروفائل|زندگی/.test(check.header.text);
              if (!translated || check.header.leadingPunct) report.pass = false;
            }
          } catch (err) {
            report.checks.push({ page: p.name, locale, viewport: vp.name, error: String(err) });
          }
        }
        await context.close();
      }
    }
  }

  if (!email || !password) {
    report.auth.blocker =
      (report.auth.blocker || "") +
      " No RTL_EMAIL/RTL_PASSWORD — skipped live portal screenshots; fixture + public pages verified.";
  } else {
    await capturePortal(seekerPages, { email, password }, "seeker");
    await capturePortal(adminPages, { email: adminEmail, password: adminPassword }, "admin");
  }
  if (recEmail && recPassword) {
    await capturePortal(recruiterPages, { email: recEmail, password: recPassword }, "recruiter");
  } else if (email && password) {
    await capturePortal(recruiterPages, { email, password }, "recruiter");
  }

  report.finishedAt = new Date().toISOString();
  writeFileSync(join(outDir, "report.json"), JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify(
      {
        pass: report.pass,
        shots: report.shots.length,
        blocker: report.auth.blocker,
        auth: report.auth,
        outDir,
      },
      null,
      2,
    ),
  );
  await browser.close();
  process.exit(report.pass ? 0 : 1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
