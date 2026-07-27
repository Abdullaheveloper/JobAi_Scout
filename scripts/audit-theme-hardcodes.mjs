/**
 * Flags dark-only / hardcoded color patterns that break light mode.
 * Writes scripts/theme-hardcode-report.txt
 *
 * Usage:
 *   node scripts/audit-theme-hardcodes.mjs
 *   node scripts/audit-theme-hardcodes.mjs --strict
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const strict = process.argv.includes("--strict");
const reportPath = join(root, "scripts", "theme-hardcode-report.txt");

const IGNORE_DIRS = new Set([
  "node_modules",
  "dist",
  ".git",
  "coverage",
  "extension",
  "services",
  "supabase",
  ".tmp-locale-zip",
]);

/** Paths where raw hex / dark glass is intentional for now */
const ALLOWLIST = [
  /[\\/]components[\\/]ui[\\/]/, // shadcn primitives (overlays use bg-black/80)
  /[\\/]components[\\/]brand[\\/]/,
  /[\\/]pages[\\/]LandingRedesign\.css$/,
  /[\\/]pages[\\/]AdminVoice\.tsx$/, // chart strokes intentional dark palette
  /[\\/]pages[\\/](Login|Register|ForgotPassword|ResetPassword|WaitingApproval)\.tsx$/, // always-light brand auth surfaces
  /[\\/]pages[\\/]About\.tsx$/, // remaining dark CTA band uses intentional white-on-dark glass
  /[\\/]index\.css$/, // Cosmic token definitions
  /\.test\.(tsx?|jsx?)$/,
  /\.spec\.(tsx?|jsx?)$/,
];

/** High-severity: surfaces locked to dark hex / black glass */
const HIGH = [
  { id: "bg-hex", re: /\bbg-\[#[0-9a-fA-F]{3,8}\]/g },
  { id: "text-hex", re: /\btext-\[#[0-9a-fA-F]{3,8}\]/g },
  { id: "bg-black-alpha", re: /\bbg-black\//g },
  { id: "border-white-alpha", re: /\bborder-white\//g },
];

/** Advisory: often OK on gradient CTAs, but worth reviewing */
const ADVISORY = [{ id: "text-white", re: /\btext-white\b/g }];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (IGNORE_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(tsx|css)$/.test(name)) out.push(full);
  }
  return out;
}

function isAllowlisted(file) {
  return ALLOWLIST.some((re) => re.test(file));
}

const srcRoot = join(root, "src");
const files = walk(srcRoot);
const findings = [];

for (const file of files) {
  if (isAllowlisted(file)) continue;
  const rel = relative(root, file).replace(/\\/g, "/");
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const rule of HIGH) {
      rule.re.lastIndex = 0;
      if (rule.re.test(line)) {
        findings.push({ severity: "high", rule: rule.id, file: rel, line: i + 1, text: line.trim().slice(0, 160) });
      }
    }
    for (const rule of ADVISORY) {
      rule.re.lastIndex = 0;
      if (rule.re.test(line)) {
        findings.push({ severity: "advisory", rule: rule.id, file: rel, line: i + 1, text: line.trim().slice(0, 160) });
      }
    }
  });
}

const high = findings.filter((f) => f.severity === "high");
const advisory = findings.filter((f) => f.severity === "advisory");

const report = [
  `Theme hardcode audit — ${new Date().toISOString()}`,
  `Files scanned: ${files.length}`,
  `High: ${high.length}  Advisory: ${advisory.length}`,
  "",
  "=== HIGH (bg-[#…], text-[#…], bg-black/, border-white/) ===",
  ...high.map((f) => `${f.file}:${f.line} [${f.rule}] ${f.text}`),
  "",
  "=== ADVISORY (text-white — OK on gradient CTAs) ===",
  ...advisory.map((f) => `${f.file}:${f.line} [${f.rule}] ${f.text}`),
  "",
  "Allowlisted: ui/*, brand/*, LandingRedesign.css, AdminVoice.tsx, index.css, auth brand pages, About.tsx (dark CTA band)",
].join("\n");

writeFileSync(reportPath, report, "utf8");
console.log(report);
console.log(`\nWrote ${reportPath}`);

if (strict && high.length > 0) {
  console.error(`theme:audit:strict failed with ${high.length} high findings`);
  process.exit(1);
}
