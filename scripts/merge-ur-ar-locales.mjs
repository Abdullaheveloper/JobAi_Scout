/**
 * Merge zip ur/ar translations onto project en.json key tree.
 * Exact matching keys prefer zip content; aliases map renamed zip keys;
 * remaining keys stay English (temporary fill).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const en = JSON.parse(readFileSync(join(root, "src/locales/en.json"), "utf8"));

const aliases = {
  "common.appName": "brand.name",
  "common.requiredField": "common.required",
  "common.somethingWentWrong": "errors.generic",
  "nav.uploadCV": "nav.uploadCv",
  "nav.logout": "common.signOut",
  "landing.ctaPrimary": "landing.ctaStartWorkspace",
  "landing.ctaSecondary": "landing.ctaSeeHow",
  "landing.aiActive": "common.aiActive",
  "signup.fullNameLabel": "signup.fullName",
  "signup.submitButton": "signup.submit",
  "signup.alreadyHaveAccount": "signup.alreadyHave",
  "signup.signInLink": "signin.createAccount",
  "signup.pendingApprovalMessage": "signup.toastCreatedBody",
  "signin.submitButton": "signin.submit",
  "signin.signUpLink": "signin.createFree",
  "signin.subtitle": "signin.welcomeBack",
  "cv.uploadSubtitle": "cv.uploadDescription",
  "cv.uploadButton": "cv.analyze",
  "jobs.scrapeJobs": "jobs.scrapeButton",
  "jobs.heroTitle": "jobs.title",
  "jobs.heroSubtitle": "jobs.subtitle",
  "savedJobs.title": "saved.title",
  "savedJobs.emptyState": "saved.emptyTitle",
  "voiceAssistant.title": "voice.title",
  "voiceAssistant.subtitle": "voice.subtitle",
  "profile.title": "settings.title",
  "profile.subtitle": "settings.subtitle",
  "profile.profileImageTitle": "settings.profileImage",
  "profile.replaceImage": "settings.uploadImage",
  "profile.fullNameLabel": "settings.fullName",
  "profile.emailLabel": "settings.email",
  "profile.phoneLabel": "settings.phone",
  "profile.locationLabel": "settings.location",
  "cookies.message": "cookies.description",
  "cookies.settingsLink": "cookies.settings",
  "admin.title": "admin.dashboardTitle",
  "admin.adminDashboard": "nav.adminDashboard",
  "admin.platformAnalytics": "nav.platformAnalytics",
  "admin.pendingApproval": "admin.pendingApprovals",
  "admin.deleteAccount": "admin.deletePermanently",
};

function collectKeys(value, prefix = "") {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return Object.entries(value).flatMap(([key, child]) =>
      collectKeys(child, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [prefix];
}

function get(obj, key) {
  return key.split(".").reduce((acc, part) => acc?.[part], obj);
}

function set(obj, key, val) {
  const parts = key.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]] || typeof cur[parts[i]] !== "object") cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = val;
}

function mergeLocale(zipPath, code) {
  const zip = JSON.parse(readFileSync(zipPath, "utf8"));
  const out = JSON.parse(JSON.stringify(en));
  const enKeys = new Set(collectKeys(en));
  const zipKeys = collectKeys(zip);
  const covered = new Set();
  const zipOnly = [];
  const applied = [];

  for (const k of zipKeys) {
    const candidates = [k, aliases[k]].filter(Boolean);
    let appliedKey = null;
    for (const c of candidates) {
      if (enKeys.has(c)) {
        appliedKey = c;
        break;
      }
    }
    if (!appliedKey) {
      zipOnly.push(k);
      continue;
    }
    const val = get(zip, k);
    if (typeof val === "string") {
      set(out, appliedKey, val);
      covered.add(appliedKey);
      applied.push({ from: k, to: appliedKey });
    }
  }

  const missing = [...enKeys].filter((k) => !covered.has(k));
  writeFileSync(join(root, "src/locales", `${code}.json`), `${JSON.stringify(out, null, 2)}\n`);
  return {
    code,
    enKeys: enKeys.size,
    zipKeys: zipKeys.length,
    covered: covered.size,
    missing: missing.length,
    zipOnly,
    appliedCount: applied.length,
    missingSample: missing.slice(0, 40),
  };
}

const ur = mergeLocale(join(root, ".tmp-ur-ar-zip/ur.json"), "ur");
const ar = mergeLocale(join(root, ".tmp-ur-ar-zip/ar.json"), "ar");
const report = { ur, ar };
writeFileSync(join(root, ".tmp-ur-ar-zip/merge-report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
