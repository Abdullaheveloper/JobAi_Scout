/**
 * Scans TSX/JSX for likely hardcoded user-facing English string literals.
 * Covers JSX text nodes AND user-facing attributes (placeholder, alt, title,
 * aria-label, …) — attributes are why placeholders kept being missed.
 *
 * Writes scripts/i18n-untranslated-report.txt and exits 1 if findings exist
 * under --strict (used for focused pages / CI gates).
 *
 * Usage:
 *   node scripts/audit-untranslated.mjs
 *   node scripts/audit-untranslated.mjs --strict --paths=src/pages/Automation.tsx,src/components/voice
 *   node scripts/audit-untranslated.mjs --attrs-only
 */
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const args = process.argv.slice(2);
const strict = args.includes("--strict");
const attrsOnly = args.includes("--attrs-only");
const pathsArg = args.find((a) => a.startsWith("--paths="));
const outArg = args.find((a) => a.startsWith("--out="));
const focusPaths = pathsArg
  ? pathsArg
      .slice("--paths=".length)
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)
  : null;
const reportPath = outArg
  ? join(root, outArg.slice("--out=".length))
  : join(root, "scripts", "i18n-untranslated-report.txt");

const IGNORE_DIRS = new Set([
  "node_modules",
  "dist",
  ".git",
  "coverage",
  "extension",
  "services",
  "supabase",
  ".tmp-locale-zip",
  ".tmp-ur-ar-zip",
]);

const IGNORE_FILES = [
  /[\\/]ui[\\/]/, // shadcn primitives
  /\.test\.(tsx?|jsx?)$/,
  /\.spec\.(tsx?|jsx?)$/,
];

/** User-facing attributes that must be translated (paired with eslint jsx-attributes include). */
const USER_ATTRS =
  "placeholder|alt|title|aria-label|aria-placeholder|aria-roledescription|aria-valuetext|label|description|message|eyebrow|detail|actionLabel|toast";

/** Skip strings that are clearly non-UI */
const SKIP_STRING = /^(https?:|mailto:|tel:|chrome:|edge:|\/|#|[a-z]+(-[a-z0-9]+)+$|[A-Z_]{2,}$)/i;
const SKIP_EXACT = new Set([
  "",
  " ",
  "·",
  "•",
  "—",
  "✓",
  "✗",
  "...",
  "…",
  "px",
  "rem",
  "em",
  "flex",
  "grid",
  "hidden",
  "sm",
  "md",
  "lg",
  "xl",
  "2xl",
]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (IGNORE_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(tsx|jsx)$/.test(name)) out.push(full);
  }
  return out;
}

function shouldIgnoreFile(file) {
  return IGNORE_FILES.some((re) => re.test(file));
}

function shouldKeepFinding(text) {
  if (!text || SKIP_EXACT.has(text)) return false;
  if (SKIP_STRING.test(text)) return false;
  if (!/[A-Za-z]{3,}/.test(text)) return false;
  if (/^\$\{/.test(text) || /^\{/.test(text)) return false;
  return true;
}

/**
 * Heuristic scan: JSX text nodes + user-facing attributes + common object labels.
 * Does not pretend to be a full AST — pairs with eslint-plugin-i18next for CI.
 */
function scanFile(file) {
  const source = readFileSync(file, "utf8");
  const lines = source.split(/\r?\n/);
  const findings = [];

  const jsxText = />\s*([A-Za-z][^<{]*?[A-Za-z.!?]|\d+%?)\s*</g;
  // Literal attributes: placeholder="…"
  const attrLiteral = new RegExp(
    `\\b(${USER_ATTRS})\\s*=\\s*["'\`]([^"'\`]{2,})["'\`]`,
    "g",
  );
  // Expression attributes with a bare string: placeholder={"…"} (not t(...))
  const attrExprString = new RegExp(
    `\\b(${USER_ATTRS})\\s*=\\s*\\{\\s*["'\`]([^"'\`]{2,})["'\`]\\s*\\}`,
    "g",
  );
  const objectLabel =
    /\b(label|title|description|message|eyebrow|detail|action|placeholder)\s*:\s*["'`]([^"'`]{2,})["'`]/g;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("import ")) continue;

    // Skip lines whose only stringy content is inside t(...) calls.
    const withoutT = line.replace(/\bt\s*\([^)]*\)/g, "");
    if (/\bt\s*\(/.test(line) && !/["'`][A-Za-z]/.test(withoutT) && !attrsOnly) {
      // Still scan attributes on the same line in case of mixed usage.
    }

    const checks = attrsOnly
      ? [
          { pattern: attrLiteral, kind: "attr" },
          { pattern: attrExprString, kind: "attr" },
        ]
      : [
          { pattern: jsxText, kind: "text" },
          { pattern: attrLiteral, kind: "attr" },
          { pattern: attrExprString, kind: "attr" },
          { pattern: objectLabel, kind: "object" },
        ];

    for (const { pattern, kind } of checks) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(line)) !== null) {
        const text = (match[2] ?? match[1]).trim();
        if (!shouldKeepFinding(text)) continue;
        if (/className|clsx|cn\(|gradient-|from-|to-|via-/.test(line) && kind === "text") continue;
        // Skip attribute values that are clearly t() expressions (defensive).
        if (kind === "attr" && /\{t\s*\(/.test(match[0])) continue;
        findings.push({
          line: i + 1,
          kind,
          attr: kind === "attr" ? match[1] : undefined,
          text: text.slice(0, 120),
          snippet: trimmed.slice(0, 160),
        });
      }
    }
  }

  return findings;
}

function resolveTargets() {
  if (!focusPaths) return walk(join(root, "src")).filter((f) => !shouldIgnoreFile(f));
  const files = [];
  for (const p of focusPaths) {
    const full = join(root, p);
    const st = statSync(full);
    if (st.isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files.filter((f) => !shouldIgnoreFile(f));
}

const files = resolveTargets();
const allFindings = [];

for (const file of files) {
  const findings = scanFile(file);
  if (!findings.length) continue;
  allFindings.push({ file: relative(root, file).replace(/\\/g, "/"), findings });
}

const criticalPrefixes = [
  "src/pages/Automation.tsx",
  "src/pages/CVUpload.tsx",
  "src/pages/AutoFormFill.tsx",
  "src/pages/VoiceAssistant.tsx",
  "src/components/automation/",
  "src/components/voice/",
];

const criticalFindings = allFindings.filter((entry) =>
  criticalPrefixes.some((prefix) => entry.file === prefix || entry.file.startsWith(prefix)),
);

const attrHitCount = allFindings.reduce(
  (n, e) => n + e.findings.filter((f) => f.kind === "attr").length,
  0,
);

const header = [
  `i18n untranslated string audit`,
  `Generated: ${new Date().toISOString()}`,
  `Files scanned: ${files.length}`,
  `Files with findings: ${allFindings.length}`,
  `Attribute findings (placeholder/alt/title/aria-*): ${attrHitCount}`,
  `Critical-page findings (Automation / Voice / CV / Form Fill): ${criticalFindings.reduce((n, e) => n + e.findings.length, 0)} hits in ${criticalFindings.length} files`,
  attrsOnly ? `Mode: attrs-only` : `Mode: text + attrs + object labels`,
  ``,
  `Intentional exceptions (do not translate):`,
  `- User-entered data (automation schedule names, CV field values, transcript text)`,
  `- Job titles / company names from APIs`,
  `- Technical URLs (chrome://extensions), file names, MIME types`,
  `- Brand name "JobAI Scout" when used as product identity`,
  ``,
  `=`.repeat(72),
  ``,
];

const body = [];
const sections = focusPaths ? allFindings : [...criticalFindings, ...allFindings.filter((e) => !criticalFindings.includes(e))];

for (const entry of sections) {
  body.push(`## ${entry.file} (${entry.findings.length})`);
  for (const f of entry.findings) {
    const tag = f.kind === "attr" ? `[attr:${f.attr}]` : `[${f.kind}]`;
    body.push(`  L${f.line} ${tag}: "${f.text}"`);
  }
  body.push("");
}

mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, [...header, ...body].join("\n"), "utf8");

console.log(`Wrote ${reportPath}`);
console.log(`Files with findings: ${allFindings.length}`);
console.log(`Attribute hits: ${attrHitCount}`);
console.log(`Critical-page hits: ${criticalFindings.reduce((n, e) => n + e.findings.length, 0)}`);

if (strict) {
  const target = focusPaths ? allFindings : criticalFindings;
  const count = target.reduce((n, e) => n + e.findings.length, 0);
  if (count > 0) {
    console.error(`\nAudit FAILED: ${count} likely untranslated UI strings`);
    process.exitCode = 1;
  } else {
    console.log("\nAudit PASSED for scoped paths / critical pages");
  }
}
