import type { NormalizedJob } from "../job-collection.ts";

export type CompanyCareerSource = { id: string; name: string; url: string };
export type CompanyCareerSourceResult = { source: CompanyCareerSource; jobs: NormalizedJob[]; error: string | null };

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/&(?:amp|quot|#39);/g, " ").replace(/\s+/g, " ").trim();
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function absoluteUrl(value: unknown, base: string): string | null {
  try { return new URL(String(value || ""), base).toString(); } catch { return null; }
}

function normalizedAtsJob(raw: Record<string, unknown>, company: string, fallbackUrl: string): NormalizedJob | null {
  const locationValue = raw.location;
  const location = typeof locationValue === "string" ? locationValue : locationValue && typeof locationValue === "object"
    ? String((locationValue as Record<string, unknown>).name || (locationValue as Record<string, unknown>).city || "") : "";
  const title = String(raw.title || raw.name || "").trim();
  const url = absoluteUrl(raw.absolute_url || raw.hostedUrl || raw.applyUrl || raw.jobUrl || raw.url, fallbackUrl);
  if (!title || !url) return null;
  return { title, company, location: location || null, description: raw.content || raw.description ? stripHtml(String(raw.content || raw.description)) : null,
    skills: [], job_type: raw.employmentType || raw.workplaceType ? String(raw.employmentType || raw.workplaceType) : null,
    work_mode: /remote/i.test(`${location} ${raw.workplaceType || ""}`) ? "remote" : null, experience_level: null,
    salary_min: null, salary_max: null, salary_currency: null, source: "company_career",
    source_job_id: String(raw.id || raw.shortcode || url), source_url: url,
    recruiter_id: null, posted_at: raw.published || raw.createdAt || raw.updated_at ? String(raw.published || raw.createdAt || raw.updated_at) : null };
}

async function collectFromAts(url: string, company: string, signal: AbortSignal, html = ""): Promise<NormalizedJob[] | null> {
  const evidence = `${url}\n${html}`;
  let endpoint = "";
  let kind: "greenhouse" | "lever" | "workable" | "smartrecruiters" | "ashby" | null = null;
  const greenhouse = evidence.match(/(?:boards|job-boards)\.greenhouse\.io\/(?:embed\/job_board\?for=)?([a-z0-9_-]+)/i);
  const lever = evidence.match(/jobs\.lever\.co\/([a-z0-9_-]+)/i);
  const workable = evidence.match(/apply\.workable\.com\/([a-z0-9_-]+)/i);
  const smart = evidence.match(/careers\.smartrecruiters\.com\/([a-z0-9_-]+)/i);
  const ashby = evidence.match(/jobs\.ashbyhq\.com\/([a-z0-9_-]+)/i);
  if (greenhouse) { kind = "greenhouse"; endpoint = `https://boards-api.greenhouse.io/v1/boards/${greenhouse[1]}/jobs?content=true`; }
  else if (lever) { kind = "lever"; endpoint = `https://api.lever.co/v0/postings/${lever[1]}?mode=json`;
  } else if (smart) { kind = "smartrecruiters"; endpoint = `https://api.smartrecruiters.com/v1/companies/${smart[1]}/postings?limit=100`;
  } else if (ashby) { kind = "ashby"; endpoint = `https://api.ashbyhq.com/posting-api/job-board/${ashby[1]}`;
  } else if (workable) { kind = "workable"; endpoint = `https://apply.workable.com/api/v3/accounts/${workable[1]}/jobs`; }
  if (!kind) return null;
  const response = await fetch(endpoint, { method: kind === "workable" ? "POST" : "GET", headers: { Accept: "application/json", ...(kind === "workable" ? { "Content-Type": "application/json" } : {}) }, body: kind === "workable" ? JSON.stringify({ query: "", location: [], department: [], worktype: [], remote: [] }) : undefined, signal });
  if (!response.ok) throw new Error(`${kind} public jobs API failed (${response.status})`);
  const data = await response.json();
  const rows = Array.isArray(data) ? data : data.jobs || data.content || data.results || data.postings || [];
  return (Array.isArray(rows) ? rows : []).map((row: unknown) => normalizedAtsJob(row as Record<string, unknown>, company, url)).filter((job: NormalizedJob | null): job is NormalizedJob => Boolean(job));
}

let nextFirecrawlRequestAt = 0;

async function waitForFirecrawlSlot(signal: AbortSignal): Promise<void> {
  const waitMs = Math.max(0, nextFirecrawlRequestAt - Date.now());
  nextFirecrawlRequestAt = Math.max(Date.now(), nextFirecrawlRequestAt) + 3_250;
  if (!waitMs) return;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, waitMs);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    }, { once: true });
  });
}

export function parseCompanyCareerJobPostings(html: string, baseUrl: string, company: string): NormalizedJob[] {
  const output: NormalizedJob[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== "object") return;
    const item = value as Record<string, unknown>;
    if (item["@graph"]) visit(item["@graph"]);
    const types = Array.isArray(item["@type"]) ? item["@type"] : [item["@type"]];
    if (!types.some((type) => String(type).toLowerCase() === "jobposting")) return;
    const hiring = item.hiringOrganization as Record<string, unknown> | undefined;
    const place = item.jobLocation as Record<string, unknown> | Array<Record<string, unknown>> | undefined;
    const firstPlace = Array.isArray(place) ? place[0] : place;
    const address = firstPlace?.address as Record<string, unknown> | undefined;
    const location = [address?.addressLocality, address?.addressRegion, address?.addressCountry].filter(Boolean).join(", ") || null;
    const jobUrl = absoluteUrl(item.url || item.sameAs, baseUrl);
    if (!String(item.title || item.name || "").trim() || !jobUrl) return;
    output.push({ title: String(item.title || item.name).trim(), company: String(hiring?.name || company), location, description: item.description ? stripHtml(String(item.description)) : null, skills: [], job_type: item.employmentType ? String(Array.isArray(item.employmentType) ? item.employmentType[0] : item.employmentType) : null, work_mode: /remote/i.test(String(item.jobLocationType || "")) ? "remote" : null, experience_level: item.experienceRequirements ? stripHtml(String(item.experienceRequirements)) : null, salary_min: null, salary_max: null, salary_currency: null, source: "company_career", source_job_id: String(item.identifier && typeof item.identifier === "object" ? (item.identifier as Record<string, unknown>).value || jobUrl : item.identifier || jobUrl), source_url: jobUrl, recruiter_id: null, posted_at: item.datePosted ? String(item.datePosted) : null });
  };
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { visit(JSON.parse(match[1])); } catch { /* Ignore malformed third-party JSON-LD blocks. */ }
  }
  return output;
}

async function collectPublicCareerLinks(url: string, company: string, signal: AbortSignal): Promise<NormalizedJob[]> {
  const directAts = await collectFromAts(url, company, signal);
  if (directAts?.length) return directAts.slice(0, 50);
  const response = await fetch(url, { headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": "Mozilla/5.0 (compatible; JobAI-Scout/1.0; +job-discovery)" }, signal, redirect: "follow" });
  if (!response.ok) throw new Error(`Company careers page failed (${response.status})`);
  const html = await response.text();
  const embeddedAts = await collectFromAts(response.url || url, company, signal, html);
  if (embeddedAts?.length) return embeddedAts.slice(0, 50);
  const structured = parseCompanyCareerJobPostings(html, url, company);
  if (structured.length) return structured.slice(0, 50);
  const seen = new Set<string>();
  const jobs: NormalizedJob[] = [];
  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let href: string;
    try {
      href = new URL(match[1], url).toString();
    } catch {
      continue;
    }
    const title = stripHtml(match[2]);
    if (!title || title.length < 3 || /^(jobs?|careers?|open positions?|view openings?|join us|apply)$/i.test(title) || !/job|position|opening|apply|vacanc|lever|greenhouse|ashby|workday/i.test(`${href} ${title}`) || seen.has(href)) continue;
    seen.add(href);
    jobs.push({ title, company, location: null, description: null, skills: [], job_type: null, work_mode: null, experience_level: null, salary_min: null, salary_max: null, salary_currency: null, source: "company_career", source_job_id: href, source_url: href, recruiter_id: null, posted_at: null });
  }
  if (!jobs.length) throw new Error("No JobPosting data or individual public job links were found; the page may require JavaScript or block automated access");
  return jobs.slice(0, 50);
}

async function collectWithFirecrawl(url: string, company: string, token: string, signal: AbortSignal): Promise<NormalizedJob[]> {
  await waitForFirecrawlSlot(signal);
  const schema = { type: "object", properties: { jobs: { type: "array", items: { type: "object", properties: { title: { type: "string" }, location: { type: "string" }, description: { type: "string" }, url: { type: "string" }, job_type: { type: "string" }, work_mode: { type: "string" }, posted_at: { type: "string" } }, required: ["title"] } } }, required: ["jobs"] };
  const response = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url, formats: [{ type: "json", schema, prompt: "Extract only current job openings from this official company careers page. Do not invent values." }], onlyMainContent: true }),
    signal,
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Firecrawl company career scrape failed (${response.status})${detail ? `: ${detail.slice(0, 180)}` : ""}`);
  }
  const data = await response.json();
  const jobs = data?.data?.json?.jobs || data?.json?.jobs || [];
  if (!Array.isArray(jobs) || !jobs.length) throw new Error("Company career scraper returned no openings");
  return jobs
    .filter((job: Record<string, unknown>) => String(job.title || "").trim() && absoluteUrl(job.url, url))
    .map((job: Record<string, unknown>) => { const jobUrl = absoluteUrl(job.url, url)!; return { title: String(job.title).trim(), company, location: job.location ? String(job.location) : null, description: job.description ? String(job.description) : null, skills: [], job_type: job.job_type ? String(job.job_type) : null, work_mode: job.work_mode ? String(job.work_mode) : null, experience_level: null, salary_min: null, salary_max: null, salary_currency: null, source: "company_career", source_job_id: job.id ? String(job.id) : jobUrl, source_url: jobUrl, recruiter_id: null, posted_at: job.posted_at ? String(job.posted_at) : null }; });
}

const batchSchema = { type: "object", properties: { jobs: { type: "array", items: { type: "object", properties: { title: { type: "string" }, location: { type: "string" }, description: { type: "string" }, url: { type: "string" }, job_type: { type: "string" }, work_mode: { type: "string" }, posted_at: { type: "string" } }, required: ["title", "url"] } } }, required: ["jobs"] };

function extractedJobs(value: unknown, source: CompanyCareerSource): NormalizedJob[] {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const payload = (record.json && typeof record.json === "object" ? record.json : record) as Record<string, unknown>;
  const jobs = Array.isArray(payload.jobs) ? payload.jobs : [];
  return jobs.flatMap((raw) => {
    const job = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    const jobUrl = absoluteUrl(job.url, source.url);
    if (!String(job.title || "").trim() || !jobUrl) return [];
    return [{ title: String(job.title).trim(), company: source.name, location: job.location ? String(job.location) : null, description: job.description ? stripHtml(String(job.description)) : null, skills: [], job_type: job.job_type ? String(job.job_type) : null, work_mode: job.work_mode ? String(job.work_mode) : null, experience_level: null, salary_min: null, salary_max: null, salary_currency: null, source: "company_career", source_job_id: jobUrl, source_url: jobUrl, recruiter_id: null, posted_at: job.posted_at ? String(job.posted_at) : null } satisfies NormalizedJob];
  });
}

async function collectFirecrawlBatch(sources: CompanyCareerSource[], token: string, signal: AbortSignal, query = ""): Promise<Map<string, { jobs: NormalizedJob[]; error: string | null }>> {
  const output = new Map<string, { jobs: NormalizedJob[]; error: string | null }>();
  const start = await fetch("https://api.firecrawl.dev/v2/batch/scrape", {
    method: "POST", signal,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ urls: sources.map((source) => source.url), maxConcurrency: 2, ignoreInvalidURLs: true, onlyMainContent: true, timeout: 30_000, formats: [{ type: "json", schema: batchSchema, prompt: `Extract only current individual job openings relevant to "${query || "the requested role"}". Each job must have its own application or details URL. Do not invent jobs or URLs.` }] }),
  });
  if (!start.ok) throw new Error(`Firecrawl batch failed (${start.status}): ${(await start.text().catch(() => "")).slice(0, 220)}`);
  const started = await start.json();
  if (!started?.id) throw new Error("Firecrawl batch did not return a job id");

  let status: Record<string, unknown> = {};
  while (!signal.aborted) {
    const response = await fetch(`https://api.firecrawl.dev/v2/batch/scrape/${started.id}`, { headers: { Authorization: `Bearer ${token}` }, signal });
    if (!response.ok) throw new Error(`Firecrawl batch status failed (${response.status})`);
    status = await response.json();
    if (status.status === "completed" || status.status === "failed") break;
    await new Promise<void>((resolve, reject) => { const timer = setTimeout(resolve, 1_000); signal.addEventListener("abort", () => { clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); }, { once: true }); });
  }
  const pages = Array.isArray(status.data) ? status.data as Array<Record<string, unknown>> : [];
  for (const source of sources) {
    const normalizedSourceUrl = source.url.replace(/\/$/, "");
    const page = pages.find((candidate) => {
      const metadata = candidate.metadata && typeof candidate.metadata === "object" ? candidate.metadata as Record<string, unknown> : {};
      return [metadata.sourceURL, metadata.url].some((value) => absoluteUrl(value, source.url)?.replace(/\/$/, "") === normalizedSourceUrl);
    });
    const jobs = page ? extractedJobs(page, source) : [];
    output.set(source.id, { jobs, error: page ? null : "The batch scraper returned no page result for this URL" });
  }
  return output;
}

export async function collectCompanyCareerSources(
  sources: CompanyCareerSource[], signal: AbortSignal,
  options: { query?: string; maxItems?: number } = {},
  onSource?: (result: CompanyCareerSourceResult) => void,
): Promise<CompanyCareerSourceResult[]> {
  const queryTerms = String(options.query || "").toLowerCase().replace(/[^a-z0-9+#.\s-]/g, " ").split(/\s+/).filter((term) => term.length >= 2);
  const keepRelevant = (jobs: NormalizedJob[]) => jobs.filter((job) => {
    if (!queryTerms.length) return true;
    const evidence = `${job.title} ${job.description || ""} ${(job.skills || []).join(" ")}`.toLowerCase();
    return queryTerms.some((term) => evidence.includes(term));
  }).slice(0, Math.min(Math.max(options.maxItems || 25, 1), 50));
  const results = new Map<string, CompanyCareerSourceResult>();
  const publicResults = await Promise.all(sources.map(async (source) => {
    try { return { source, jobs: keepRelevant(await collectPublicCareerLinks(source.url, source.name, signal)), error: null }; }
    catch (error) { return { source, jobs: [] as NormalizedJob[], error: error instanceof Error ? error.message : "Public page extraction failed" }; }
  }));
  const fallbacks: CompanyCareerSource[] = [];
  for (const result of publicResults) {
    if (!result.error) { results.set(result.source.id, result); onSource?.(result); }
    else fallbacks.push(result.source);
  }
  const token = typeof Deno !== "undefined" ? Deno.env.get("FIRECRAWL_API_TOKEN") : undefined;
  if (fallbacks.length && token && !signal.aborted) {
    // Keep requests affordable: Firecrawl bills each URL and rejects a large
    // batch wholesale when the balance cannot cover it. Small batches preserve
    // results from earlier companies when only a few credits remain.
    const pending = [...fallbacks];
    while (pending.length && !signal.aborted) {
      const chunk = pending.splice(0, 2);
      try {
        const batch = await collectFirecrawlBatch(chunk, token, signal, options.query);
        for (const source of chunk) {
          const value = batch.get(source.id) || { jobs: [], error: "No batch result was returned" };
          const result = { source, ...value, jobs: keepRelevant(value.jobs) }; results.set(source.id, result); onSource?.(result);
        }
      } catch (error) {
        const detail = error instanceof Error ? error.message : "Firecrawl batch failed";
        for (const source of chunk) { const result = { source, jobs: [] as NormalizedJob[], error: detail }; results.set(source.id, result); onSource?.(result); }
        if (/\(402\)|insufficient credits/i.test(detail)) {
          for (const source of pending.splice(0)) {
            const result = { source, jobs: [] as NormalizedJob[], error: "Firecrawl credit balance was exhausted; public-page extraction also found no openings" };
            results.set(source.id, result); onSource?.(result);
          }
        }
      }
    }
  } else {
    for (const source of fallbacks) { const prior = publicResults.find((item) => item.source.id === source.id)!; results.set(source.id, prior); onSource?.(prior); }
  }
  return sources.map((source) => results.get(source.id) || { source, jobs: [], error: "Collection stopped before this source ran" });
}

export async function collectCompanyCareerJobs(url: string, company: string, signal?: AbortSignal): Promise<NormalizedJob[]> {
  const token = typeof Deno !== "undefined" ? Deno.env.get("FIRECRAWL_API_TOKEN") : undefined;
  const controller = new AbortController();
  const abortFromParent = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", abortFromParent, { once: true });
  if (signal?.aborted) controller.abort(signal.reason);
  try {
    // Do not spend a Firecrawl request when the public page already exposes
    // JobPosting JSON-LD or individual job links. Firecrawl is a rate-limited
    // fallback for JavaScript-only/blocked pages, and calls are paced globally.
    try {
      return await collectPublicCareerLinks(url, company, controller.signal);
    } catch (publicError) {
      if (!token) throw publicError;
      try {
        return await collectWithFirecrawl(url, company, token, controller.signal);
      } catch (firecrawlError) {
        throw new Error(`Company careers extraction failed: ${firecrawlError instanceof Error ? firecrawlError.message : String(firecrawlError)} | ${publicError instanceof Error ? publicError.message : String(publicError)}`.slice(0, 700));
      }
    }
  } catch (error) {
    if (isAbortError(error) || controller.signal.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    throw error;
  } finally {
    signal?.removeEventListener("abort", abortFromParent);
    controller.abort();
  }
}
