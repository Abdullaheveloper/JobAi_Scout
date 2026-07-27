/**
 * Systematic physical → logical CSS/Tailwind conversion for RTL.
 * Skips intentional physical positioning in sheet/sidebar/carousel/resizable.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, extname, relative } from "node:path";

const srcRoot = join(process.cwd(), "src");
const exts = new Set([".ts", ".tsx", ".js", ".jsx", ".css"]);

const SKIP_LEFT_RIGHT = new Set([
  "components/ui/sidebar.tsx",
  "components/ui/sheet.tsx",
  "components/ui/carousel.tsx",
  "components/ui/resizable.tsx",
]);

const stats = { filesTouched: 0, replacements: 0, byRule: {}, skippedPhysical: [] };

function bump(rule, n = 1) {
  stats.byRule[rule] = (stats.byRule[rule] || 0) + n;
  stats.replacements += n;
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (exts.has(extname(p))) out.push(p);
  }
  return out;
}

function convertFile(filePath, content) {
  let next = content;
  const rel = relative(srcRoot, filePath).replace(/\\/g, "/");
  const isCss = filePath.endsWith(".css");

  if (isCss) {
    const pairs = [
      [/padding-left\s*:/g, "padding-inline-start:", "css:padding-left"],
      [/padding-right\s*:/g, "padding-inline-end:", "css:padding-right"],
      [/margin-left\s*:/g, "margin-inline-start:", "css:margin-left"],
      [/margin-right\s*:/g, "margin-inline-end:", "css:margin-right"],
      [/text-align\s*:\s*left\b/g, "text-align: start", "css:text-align:left"],
      [/text-align\s*:\s*right\b/g, "text-align: end", "css:text-align:right"],
      [/float\s*:\s*left\b/g, "float: inline-start", "css:float:left"],
      [/float\s*:\s*right\b/g, "float: inline-end", "css:float:right"],
    ];
    for (const [re, repl, name] of pairs) {
      const matches = next.match(re);
      if (matches?.length) {
        bump(name, matches.length);
        next = next.replace(re, repl);
      }
    }
    return next;
  }

  const rules = [
    // negative margins/paddings first
    [/(?<![\w-])-ml-(?=(\[|[^\s"'`]+))/g, "-ms-", "-ml-"],
    [/(?<![\w-])-mr-(?=(\[|[^\s"'`]+))/g, "-me-", "-mr-"],
    [/(?<![\w-])-pl-(?=(\[|[^\s"'`]+))/g, "-ps-", "-pl-"],
    [/(?<![\w-])-pr-(?=(\[|[^\s"'`]+))/g, "-pe-", "-pr-"],
    [/(?<![\w-])ml-(?=(\[|[^\s"'`]+))/g, "ms-", "ml-"],
    [/(?<![\w-])mr-(?=(\[|[^\s"'`]+))/g, "me-", "mr-"],
    [/(?<![\w-])pl-(?=(\[|[^\s"'`]+))/g, "ps-", "pl-"],
    [/(?<![\w-])pr-(?=(\[|[^\s"'`]+))/g, "pe-", "pr-"],
    [/\btext-left\b/g, "text-start", "text-left"],
    [/\btext-right\b/g, "text-end", "text-right"],
    [/(?<![\w-])scroll-ml-/g, "scroll-ms-", "scroll-ml-"],
    [/(?<![\w-])scroll-mr-/g, "scroll-me-", "scroll-mr-"],
    [/(?<![\w-])scroll-pl-/g, "scroll-ps-", "scroll-pl-"],
    [/(?<![\w-])scroll-pr-/g, "scroll-pe-", "scroll-pr-"],
    // rounded — do not touch rounded-lg / rounded-xl / etc.
    [/\brounded-l(?!g)(?=-|\b)/g, "rounded-s", "rounded-l"],
    [/\brounded-r(?=-|\b)/g, "rounded-e", "rounded-r"],
    [/\brounded-tl\b/g, "rounded-ss", "rounded-tl"],
    [/\brounded-tr\b/g, "rounded-se", "rounded-tr"],
    [/\brounded-bl\b/g, "rounded-es", "rounded-bl"],
    [/\brounded-br\b/g, "rounded-ee", "rounded-br"],
    [/\brounded-tl-/g, "rounded-ss-", "rounded-tl-"],
    [/\brounded-tr-/g, "rounded-se-", "rounded-tr-"],
    [/\brounded-bl-/g, "rounded-es-", "rounded-bl-"],
    [/\brounded-br-/g, "rounded-ee-", "rounded-br-"],
    // borders — avoid border-collapse / border-spacing etc.
    [/\bborder-l(?=-|\b)/g, "border-s", "border-l"],
    [/\bborder-r(?=-|\b)/g, "border-e", "border-r"],
  ];

  if (!SKIP_LEFT_RIGHT.has(rel)) {
    rules.push(
      [/(?<![\w-])-left-(?=(\[|[^\s"'`]+))/g, "-start-", "-left-"],
      [/(?<![\w-])-right-(?=(\[|[^\s"'`]+))/g, "-end-", "-right-"],
      [/(?<![\w-])left-(?=(\[|[^\s"'`]+))/g, "start-", "left-"],
      [/(?<![\w-])right-(?=(\[|[^\s"'`]+))/g, "end-", "right-"],
    );
  } else {
    stats.skippedPhysical.push(rel);
  }

  for (const [re, repl, name] of rules) {
    let count = 0;
    next = next.replace(re, () => {
      count++;
      return repl;
    });
    if (count) bump(name, count);
  }

  return next;
}

const files = walk(srcRoot);
for (const file of files) {
  const before = readFileSync(file, "utf8");
  const after = convertFile(file, before);
  if (after !== before) {
    writeFileSync(file, after);
    stats.filesTouched++;
  }
}

writeFileSync(join(process.cwd(), "scripts/rtl-conversion-report.json"), `${JSON.stringify(stats, null, 2)}\n`);
console.log(JSON.stringify(stats, null, 2));
