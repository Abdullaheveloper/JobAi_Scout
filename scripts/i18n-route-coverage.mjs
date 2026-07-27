/**
 * Maps every React Router route in src/App.tsx → page component file(s)
 * and whether the i18n audit has scanned them (with attr-aware findings).
 *
 * Writes:
 *   scripts/i18n-route-coverage.md
 *   scripts/i18n-route-coverage.json
 *
 * Usage:
 *   node scripts/i18n-route-coverage.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const appPath = join(root, "src", "App.tsx");
const outMd = join(root, "scripts", "i18n-route-coverage.md");
const outJson = join(root, "scripts", "i18n-route-coverage.json");
const auditReport = join(root, "scripts", "i18n-untranslated-report.txt");

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(tsx|jsx)$/.test(name)) out.push(full);
  }
  return out;
}

/** Parse lazy imports + Route path/element from App.tsx */
function parseRoutes(source) {
  const lazyMap = new Map(); // ComponentName → ./pages/...
  const lazyRe =
    /const\s+(\w+)\s*=\s*lazy\(\s*\(\)\s*=>\s*import\(\s*["'](\.\/[^"']+)["']\s*\)\s*\)/g;
  let m;
  while ((m = lazyRe.exec(source)) !== null) {
    lazyMap.set(m[1], m[2].replace(/^\.\//, "src/"));
  }

  const routes = [];
  const routeRe =
    /<Route\s+path=["']([^"']+)["']\s+element=\{([^}]+)\}/g;
  while ((m = routeRe.exec(source)) !== null) {
    const path = m[1];
    const elementExpr = m[2].replace(/\s+/g, " ").trim();
    // Navigate redirects
    if (/<Navigate\b/.test(elementExpr)) {
      const toMatch = elementExpr.match(/to=["']([^"']+)["']/);
      routes.push({
        path,
        kind: "redirect",
        redirectTo: toMatch?.[1] ?? null,
        components: [],
        componentFiles: [],
      });
      continue;
    }
    // ProtectedRoute wraps: <ProtectedRoute ...><Dashboard /></ProtectedRoute>
    const compNames = [...elementExpr.matchAll(/<([A-Z]\w*)\b/g)].map((x) => x[1]);
    const pageNames = compNames.filter((n) => n !== "ProtectedRoute" && lazyMap.has(n));
    const componentFiles = pageNames.map((n) => {
      let file = lazyMap.get(n);
      if (!file.endsWith(".tsx") && !file.endsWith(".jsx") && !file.endsWith(".ts")) {
        // resolve extension
        for (const ext of [".tsx", ".jsx", ".ts"]) {
          if (existsSync(join(root, file + ext))) {
            file = file + ext;
            break;
          }
        }
      }
      return file.replace(/\\/g, "/");
    });
    routes.push({
      path,
      kind: path === "*" ? "fallback" : "page",
      components: pageNames,
      componentFiles,
    });
  }
  return { routes, lazyMap };
}

/** Related component dirs often used by a page (for "audited" breadth). */
function relatedFiles(pageFile) {
  const files = new Set([pageFile]);
  const base = pageFile.replace(/\\/g, "/");
  if (base.includes("/pages/recruiter/")) {
    for (const f of walk(join(root, "src/pages/recruiter"))) {
      files.add(relative(root, f).replace(/\\/g, "/"));
    }
  }
  if (base.includes("Automation")) {
    for (const f of walk(join(root, "src/components/automation"))) {
      files.add(relative(root, f).replace(/\\/g, "/"));
    }
  }
  if (base.includes("Voice")) {
    for (const f of walk(join(root, "src/components/voice"))) {
      files.add(relative(root, f).replace(/\\/g, "/"));
    }
    files.add("src/components/VoiceWidget.tsx");
  }
  if (base.includes("CVUpload") || base.includes("ProfileSettings")) {
    for (const f of walk(join(root, "src/components/profile"))) {
      files.add(relative(root, f).replace(/\\/g, "/"));
    }
  }
  if (base.includes("AutoFormFill")) {
    files.add("src/components/VoiceWidget.tsx");
  }
  return [...files];
}

function parseAuditReport(text) {
  /** @type {Map<string, { total: number, attrs: number }>} */
  const byFile = new Map();
  let current = null;
  for (const line of text.split(/\r?\n/)) {
    const header = line.match(/^##\s+(.+?)\s+\((\d+)\)\s*$/);
    if (header) {
      current = header[1].replace(/\\/g, "/");
      byFile.set(current, { total: Number(header[2]), attrs: 0 });
      continue;
    }
    if (current && /\[attr:/.test(line)) {
      const entry = byFile.get(current);
      if (entry) entry.attrs += 1;
    }
  }
  return byFile;
}

// Ensure audit report is fresh (full src scan).
spawnSync(process.execPath, [join(root, "scripts", "audit-untranslated.mjs")], {
  cwd: root,
  stdio: "inherit",
});

const appSource = readFileSync(appPath, "utf8");
const { routes } = parseRoutes(appSource);
const auditText = existsSync(auditReport) ? readFileSync(auditReport, "utf8") : "";
const findingsByFile = parseAuditReport(auditText);

const checklist = routes.map((route) => {
  if (route.kind === "redirect") {
    return {
      path: route.path,
      kind: "redirect",
      redirectTo: route.redirectTo,
      audited: "n/a",
      components: [],
      scannedFiles: [],
      findingCount: 0,
      attrFindingCount: 0,
      notes: `Redirect → ${route.redirectTo}`,
    };
  }

  const scannedFiles = [
    ...new Set(route.componentFiles.flatMap((f) => relatedFiles(f))),
  ];
  let findingCount = 0;
  let attrFindingCount = 0;
  for (const f of scannedFiles) {
    const hit = findingsByFile.get(f);
    if (hit) {
      findingCount += hit.total;
      attrFindingCount += hit.attrs;
    }
  }

  const pageExists = route.componentFiles.every((f) => existsSync(join(root, f)));
  return {
    path: route.path,
    kind: route.kind,
    components: route.components,
    scannedFiles,
    audited: pageExists ? "yes" : "no",
    findingCount,
    attrFindingCount,
    notes: pageExists
      ? attrFindingCount > 0
        ? `${attrFindingCount} hardcoded attr(s) still open`
        : findingCount > 0
          ? `${findingCount} other literal(s) flagged`
          : "scanned; no open attr findings"
      : "missing page file",
  };
});

const generated = new Date().toISOString();
const payload = {
  generated,
  source: "src/App.tsx",
  auditReport: "scripts/i18n-untranslated-report.txt",
  routeCount: checklist.length,
  auditedPages: checklist.filter((r) => r.audited === "yes").length,
  routesWithAttrFindings: checklist.filter((r) => r.attrFindingCount > 0).length,
  routes: checklist,
};

mkdirSync(dirname(outJson), { recursive: true });
writeFileSync(outJson, JSON.stringify(payload, null, 2), "utf8");

const md = [
  `# i18n route coverage`,
  ``,
  `Generated: ${generated}`,
  ``,
  `Source router: \`src/App.tsx\``,
  `Audit input: \`scripts/i18n-untranslated-report.txt\` (attr-aware scan)`,
  ``,
  `| Route | Audited | Components scanned | Attr findings | Notes |`,
  `| --- | --- | --- | ---: | --- |`,
  ...checklist.map((r) => {
    const primary =
      r.kind === "redirect"
        ? "—"
        : (r.scannedFiles || [])
            .filter((f) => f.startsWith("src/pages/"))
            .slice(0, 3)
            .map((f) => `\`${f}\``)
            .join(", ") || "—";
    return `| \`${r.path}\` | ${r.audited} | ${primary} | ${r.attrFindingCount ?? 0} | ${r.notes} |`;
  }),
  ``,
  `## Summary`,
  ``,
  `- Routes total: **${payload.routeCount}**`,
  `- Page routes audited: **${payload.auditedPages}**`,
  `- Routes still with hardcoded attr findings: **${payload.routesWithAttrFindings}**`,
  ``,
  `Re-run: \`node scripts/i18n-route-coverage.mjs\``,
  ``,
].join("\n");

writeFileSync(outMd, md, "utf8");
console.log(`Wrote ${outMd}`);
console.log(`Wrote ${outJson}`);
console.log(
  `Routes: ${payload.routeCount}, audited pages: ${payload.auditedPages}, with attr findings: ${payload.routesWithAttrFindings}`,
);
