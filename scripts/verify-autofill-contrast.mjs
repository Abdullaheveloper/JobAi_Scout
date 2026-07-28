/**
 * Approximate WCAG contrast for Application Autofill "Always manual…" notice.
 * Tokens from ProfileSettings.tsx:
 *   light: bg-amber-100 text-amber-950
 *   dark:  bg-amber-500/20 text-amber-50 (composited over slate-950 / zinc-950 style surfaces)
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const outDir = join(process.cwd(), "scripts", "verify-career-passport-i18n");
mkdirSync(outDir, { recursive: true });

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function srgbToLin(c) {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function relLuma({ r, g, b }) {
  return 0.2126 * srgbToLin(r) + 0.7152 * srgbToLin(g) + 0.0722 * srgbToLin(b);
}

function contrast(fg, bg) {
  const L1 = relLuma(typeof fg === "string" ? hexToRgb(fg) : fg);
  const L2 = relLuma(typeof bg === "string" ? hexToRgb(bg) : bg);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

function composite(fg, bg, alpha) {
  const f = hexToRgb(fg);
  const b = hexToRgb(bg);
  return {
    r: Math.round(f.r * alpha + b.r * (1 - alpha)),
    g: Math.round(f.g * alpha + b.g * (1 - alpha)),
    b: Math.round(f.b * alpha + b.b * (1 - alpha)),
  };
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

// Tailwind v3 defaults
const AMBER_100 = "#fef3c7";
const AMBER_950 = "#451a03";
const AMBER_50 = "#fffbeb";
const AMBER_500 = "#f59e0b";
const SLATE_950 = "#020617";
const ZINC_950 = "#09090b";
const CARD_DARK = "#0f172a"; // slate-900-ish card

const lightRatio = contrast(AMBER_950, AMBER_100);
const darkBgSlate = composite(AMBER_500, SLATE_950, 0.2);
const darkBgZinc = composite(AMBER_500, ZINC_950, 0.2);
const darkBgCard = composite(AMBER_500, CARD_DARK, 0.2);
const darkRatioSlate = contrast(AMBER_50, darkBgSlate);
const darkRatioZinc = contrast(AMBER_50, darkBgZinc);
const darkRatioCard = contrast(AMBER_50, darkBgCard);

const report = {
  classes:
    "rounded-xl border border-amber-600/35 bg-amber-100 … text-amber-950 dark:border-amber-400/35 dark:bg-amber-500/20 dark:text-amber-50",
  source: "src/pages/ProfileSettings.tsx (Application Autofill notice)",
  threshold: 4.5,
  light: {
    fg: AMBER_950,
    bg: AMBER_100,
    ratio: Number(lightRatio.toFixed(2)),
    pass: lightRatio >= 4.5,
  },
  dark: {
    fg: AMBER_50,
    samples: [
      { surface: "slate-950", bg: rgbToHex(darkBgSlate), ratio: Number(darkRatioSlate.toFixed(2)), pass: darkRatioSlate >= 4.5 },
      { surface: "zinc-950", bg: rgbToHex(darkBgZinc), ratio: Number(darkRatioZinc.toFixed(2)), pass: darkRatioZinc >= 4.5 },
      { surface: "slate-900-card", bg: rgbToHex(darkBgCard), ratio: Number(darkRatioCard.toFixed(2)), pass: darkRatioCard >= 4.5 },
    ],
  },
};

report.pass = report.light.pass && report.dark.samples.every((s) => s.pass);

writeFileSync(join(outDir, "contrast-report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log(report.pass ? "PASS contrast ≥4.5:1" : "FAIL contrast");
process.exit(report.pass ? 0 : 1);
