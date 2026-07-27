/**
 * Align zip locales to project en.json key structure.
 * - Exact parity with en.json
 * - Use zip translation when the same key path exists
 * - Otherwise fill with English and report
 *
 * Usage: node scripts/merge-zip-locales.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const localesDir = join(root, "src", "locales");
const zipDir = join(root, ".tmp-locale-zip");

function isObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function collectKeys(value, prefix = "") {
  if (isObject(value)) {
    return Object.entries(value).flatMap(([k, child]) =>
      collectKeys(child, prefix ? `${prefix}.${k}` : k),
    );
  }
  return [prefix];
}

function getAt(obj, path) {
  return path.split(".").reduce((acc, part) => (acc == null ? undefined : acc[part]), obj);
}

function collectPlaceholders(str) {
  if (typeof str !== "string") return [];
  return [...str.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]).sort();
}

function placeholdersMatch(a, b) {
  return collectPlaceholders(a).join(",") === collectPlaceholders(b).join(",");
}

/** Build object with en's shape; prefer zip values for matching leaf paths. */
function alignToEn(enNode, zipNode, path, filledFromEn, usedFromZip) {
  if (!isObject(enNode)) {
    if (
      typeof zipNode === "string" &&
      typeof enNode === "string" &&
      placeholdersMatch(enNode, zipNode)
    ) {
      usedFromZip.push(path);
      return zipNode;
    }
    if (typeof zipNode === "string" && typeof enNode === "string") {
      // Same key path but incompatible placeholders — keep English.
      filledFromEn.push(`${path} (placeholder mismatch; kept EN)`);
      return enNode;
    }
    filledFromEn.push(path);
    return enNode;
  }

  const out = {};
  for (const key of Object.keys(enNode)) {
    const nextPath = path ? `${path}.${key}` : key;
    const zipChild = isObject(zipNode) ? zipNode[key] : undefined;
    out[key] = alignToEn(enNode[key], zipChild, nextPath, filledFromEn, usedFromZip);
  }
  return out;
}

const en = JSON.parse(readFileSync(join(localesDir, "en.json"), "utf8"));
const enKeys = collectKeys(en);
const report = {};

for (const code of ["fr", "de", "hi"]) {
  const zipPath = join(zipDir, `${code}.json`);
  const zip = JSON.parse(readFileSync(zipPath, "utf8"));
  const filledFromEn = [];
  const usedFromZip = [];
  const aligned = alignToEn(en, zip, "", filledFromEn, usedFromZip);

  const zipKeys = new Set(collectKeys(zip));
  const unusedZipKeys = [...zipKeys].filter((k) => !enKeys.includes(k));

  writeFileSync(join(localesDir, `${code}.json`), `${JSON.stringify(aligned, null, 2)}\n`, "utf8");

  report[code] = {
    enLeafCount: enKeys.length,
    usedFromZip: usedFromZip.length,
    filledFromEn: filledFromEn.length,
    unusedZipKeysDropped: unusedZipKeys.length,
    usedFromZipKeys: usedFromZip,
    filledFromEnKeys: filledFromEn,
    unusedZipKeys,
  };

  console.log(`\n[${code}]`);
  console.log(`  en leaf keys: ${enKeys.length}`);
  console.log(`  used from zip (exact path match): ${usedFromZip.length}`);
  console.log(`  filled from English (missing in zip): ${filledFromEn.length}`);
  console.log(`  zip-only keys dropped for parity: ${unusedZipKeys.length}`);
}

writeFileSync(
  join(root, ".tmp-locale-zip", "merge-report.json"),
  JSON.stringify(report, null, 2),
  "utf8",
);
console.log("\nWrote aligned fr/de/hi to src/locales/ and merge-report.json");
