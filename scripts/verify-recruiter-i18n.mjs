import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = "E:/JobAi_Scout";
const codes = ["en", "fr", "de", "hi", "ur", "ar"];
const en = JSON.parse(readFileSync(join(root, "src/locales/en.json"), "utf8")).recruiter;
const enKeys = Object.keys(en).sort();
console.log("en recruiter keys:", enKeys.length);

for (const code of codes) {
  const data = JSON.parse(readFileSync(join(root, `src/locales/${code}.json`), "utf8"));
  const keys = Object.keys(data.recruiter || {}).sort();
  const missing = enKeys.filter((k) => !(k in (data.recruiter || {})));
  const extra = keys.filter((k) => !(k in en));
  console.log(`${code}: keys=${keys.length} missing=${missing.join("|") || "-"} extra=${extra.join("|") || "-"}`);
}

const navNeed = [
  "companyProfile",
  "postJob",
  "myJobs",
  "applicants",
  "applicationStatus",
  "recruitment",
  "recruiterPortal",
];
for (const code of ["ur", "ar"]) {
  const nav = JSON.parse(readFileSync(join(root, `src/locales/${code}.json`), "utf8")).nav;
  for (const key of navNeed) {
    const val = nav[key];
    const englishish = /[A-Za-z]{4,}/.test(val) && !/JobAI|URL|React|TypeScript|Node/.test(val);
    console.log(`nav.${code}.${key}=${val}${englishish ? " [maybe-en]" : ""}`);
  }
}

const pages = [
  "RecruiterJobs",
  "RecruiterProfile",
  "RecruiterCandidates",
  "RecruiterApplicationStatus",
];
for (const page of pages) {
  const src = readFileSync(join(root, `src/pages/recruiter/${page}.tsx`), "utf8");
  const hard = [...src.matchAll(/(?:placeholder|title|aria-label)=["']([^"'{]+)["']/g)].map((m) => m[1]);
  const toastish = [...src.matchAll(/toast\(\{\s*title:\s*["']([^"']+)["']/g)].map((m) => m[1]);
  console.log(`${page}: hard=${JSON.stringify([...new Set([...hard, ...toastish])])}`);
  console.log(`${page}: dir-ltr count=${(src.match(/dir=["']ltr["']/g) || []).length}`);
}
