/**
 * Completeness check:
 * 1) Locale key-tree parity across en/fr/de/hi (placeholders included)
 * 2) Every t("...") / t('...') / t(`...`) key referenced in src exists in ALL locales
 *
 * Exit 1 on any failure.
 * Usage: node scripts/verify-i18n-completeness.mjs
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const localesDir = join(root, "src", "locales");
const LOCALE_CODES = ["en", "fr", "de", "hi", "ur", "ar"];

function collectKeys(value, prefix = "") {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return Object.entries(value).flatMap(([key, child]) =>
      collectKeys(child, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [prefix];
}

function collectPlaceholders(str) {
  if (typeof str !== "string") return [];
  return [...str.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]).sort();
}

function getByPath(obj, keyPath) {
  return keyPath.split(".").reduce((acc, part) => (acc == null ? undefined : acc[part]), obj);
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name === ".git") continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(tsx?|jsx?)$/.test(name)) out.push(full);
  }
  return out;
}

/** Extract static translation keys from t("a.b") / i18n.t('a.b') calls. */
function extractReferencedKeys(source) {
  const keys = new Set();
  const re = /\b(?:t|i18n\.t)\s*\(\s*(['"`])([a-zA-Z][\w.-]*)\1/g;
  let match;
  while ((match = re.exec(source)) !== null) {
    keys.add(match[2]);
  }
  return keys;
}

const locales = Object.fromEntries(
  LOCALE_CODES.map((code) => [code, JSON.parse(readFileSync(join(localesDir, `${code}.json`), "utf8"))]),
);
const keySets = Object.fromEntries(LOCALE_CODES.map((code) => [code, new Set(collectKeys(locales[code]))]));

let failed = false;

console.log("=== Locale key-tree parity ===");
for (const code of LOCALE_CODES.filter((c) => c !== "en")) {
  const missing = [...keySets.en].filter((k) => !keySets[code].has(k));
  const extra = [...keySets[code]].filter((k) => !keySets.en.has(k));
  const placeholderMismatches = [];
  for (const key of keySets.en) {
    if (!keySets[code].has(key)) continue;
    const enPh = collectPlaceholders(getByPath(locales.en, key)).join(",");
    const locPh = collectPlaceholders(getByPath(locales[code], key)).join(",");
    if (enPh !== locPh) placeholderMismatches.push(`${key}: en=[${enPh}] ${code}=[${locPh}]`);
  }
  console.log(`[${code}] keys=${keySets[code].size} (en=${keySets.en.size}) missing=${missing.length} extra=${extra.length} phMismatch=${placeholderMismatches.length}`);
  if (missing.length || extra.length || placeholderMismatches.length) {
    failed = true;
    if (missing.length) console.log("  MISSING:", missing.slice(0, 30).join(", "), missing.length > 30 ? "…" : "");
    if (extra.length) console.log("  EXTRA:", extra.slice(0, 30).join(", "), extra.length > 30 ? "…" : "");
    for (const line of placeholderMismatches.slice(0, 15)) console.log("  PH:", line);
  }
}

console.log("\n=== Code → locale key references ===");
const srcFiles = walk(join(root, "src"));
const referenced = new Set();
const byFile = [];

for (const file of srcFiles) {
  const keys = extractReferencedKeys(readFileSync(file, "utf8"));
  if (!keys.size) continue;
  byFile.push({ file: relative(root, file).replace(/\\/g, "/"), keys: [...keys].sort() });
  for (const key of keys) referenced.add(key);
}

const missingInAny = [];
for (const key of [...referenced].sort()) {
  const absent = LOCALE_CODES.filter((code) => !keySets[code].has(key));
  if (absent.length) missingInAny.push({ key, absent });
}

console.log(`Referenced static keys: ${referenced.size} across ${byFile.length} files`);
if (missingInAny.length) {
  failed = true;
  console.log(`MISSING FROM LOCALES (${missingInAny.length}):`);
  for (const item of missingInAny.slice(0, 40)) {
    console.log(`  ${item.key} → missing in: ${item.absent.join(", ")}`);
  }
  if (missingInAny.length > 40) console.log(`  … and ${missingInAny.length - 40} more`);
} else {
  console.log("All referenced static keys exist in en/fr/de/hi/ur/ar");
}

if (failed) {
  console.error("\ni18n completeness check FAILED");
  process.exitCode = 1;
} else {
  console.log("\ni18n completeness check PASSED");
}
