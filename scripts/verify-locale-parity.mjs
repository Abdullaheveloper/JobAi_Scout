/**
 * Recursively compares locale JSON key trees against en.json.
 * Usage: node scripts/verify-locale-parity.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const localesDir = join(root, "src", "locales");

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

const en = JSON.parse(readFileSync(join(localesDir, "en.json"), "utf8"));
const enKeys = new Set(collectKeys(en));
const targets = ["fr", "de", "hi"];

let failed = false;

for (const code of targets) {
  const data = JSON.parse(readFileSync(join(localesDir, `${code}.json`), "utf8"));
  const keys = new Set(collectKeys(data));
  const missing = [...enKeys].filter((k) => !keys.has(k));
  const extra = [...keys].filter((k) => !enKeys.has(k));

  const placeholderMismatches = [];
  for (const key of enKeys) {
    if (!keys.has(key)) continue;
    const enParts = key.split(".");
    let enVal = en;
    let locVal = data;
    for (const part of enParts) {
      enVal = enVal?.[part];
      locVal = locVal?.[part];
    }
    const enPh = collectPlaceholders(enVal).join(",");
    const locPh = collectPlaceholders(locVal).join(",");
    if (enPh !== locPh) {
      placeholderMismatches.push(`${key}: en=[${enPh}] ${code}=[${locPh}]`);
    }
  }

  console.log(`\n[${code}] leaf keys: ${keys.size} (en: ${enKeys.size})`);
  if (missing.length) {
    failed = true;
    console.log(`  MISSING (${missing.length}):`, missing.slice(0, 20).join(", "), missing.length > 20 ? "…" : "");
  }
  if (extra.length) {
    failed = true;
    console.log(`  EXTRA (${extra.length}):`, extra.slice(0, 20).join(", "), extra.length > 20 ? "…" : "");
  }
  if (placeholderMismatches.length) {
    failed = true;
    console.log(`  PLACEHOLDER MISMATCH (${placeholderMismatches.length}):`);
    for (const line of placeholderMismatches.slice(0, 10)) console.log("   ", line);
  }
  if (!missing.length && !extra.length && !placeholderMismatches.length) {
    console.log("  OK — 100% key parity + placeholders intact");
  }
}

if (failed) {
  process.exitCode = 1;
  console.error("\nLocale parity check FAILED");
} else {
  console.log("\nLocale parity check PASSED for fr, de, hi");
}
