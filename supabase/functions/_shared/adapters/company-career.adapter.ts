import type { NormalizedJob } from "../job-collection.ts";

// A career page is the least predictable source: some are static HTML, while
// others are rendered by an ATS in the browser.  Keep the complete attempt
// comfortably below the adapter deadline so one unreachable company cannot
// make the whole Company Careers adapter time out.
const COMPANY_CAREER_ATTEMPT_MS = 15_000;

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/&(?:amp|quot|#39);/g, " ").replace(/\s+/g, " ").trim();
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

async function collectPublicCareerLinks(url: string, company: string, signal: AbortSignal): Promise<NormalizedJob[]> {
  const response = await fetch(url, { headers: { Accept: "text/html,application/xhtml+xml" }, signal });
  if (!response.ok) throw new Error(`Company careers page failed (${response.status})`);
  const html = await response.text();
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
    if (!title || title.length < 3 || !/job|career|position|opening|apply/i.test(`${href} ${title}`) || seen.has(href)) continue;
    seen.add(href);
    jobs.push({ title, company, location: null, description: null, skills: [], job_type: null, work_mode: null, experience_level: null, salary_min: null, salary_max: null, salary_currency: null, source: "company_career", source_job_id: href, source_url: href, recruiter_id: null, posted_at: null });
  }
  if (!jobs.length) throw new Error("Company careers fallback found no public job links");
  return jobs.slice(0, 50);
}

async function collectWithFirecrawl(url: string, company: string, token: string, signal: AbortSignal): Promise<NormalizedJob[]> {
  const schema = { type: "object", properties: { jobs: { type: "array", items: { type: "object", properties: { title: { type: "string" }, location: { type: "string" }, description: { type: "string" }, url: { type: "string" }, job_type: { type: "string" }, work_mode: { type: "string" }, posted_at: { type: "string" } }, required: ["title"] } } }, required: ["jobs"] };
  const response = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url, formats: [{ type: "json", schema, prompt: "Extract only current job openings from this official company careers page. Do not invent values." }], onlyMainContent: true }),
    signal,
  });
  if (!response.ok) throw new Error(`Company career scrape failed (${response.status})`);
  const data = await response.json();
  const jobs = data?.data?.json?.jobs || data?.json?.jobs || [];
  if (!Array.isArray(jobs) || !jobs.length) throw new Error("Company career scraper returned no openings");
  return jobs
    .filter((job: Record<string, unknown>) => String(job.title || "").trim())
    .map((job: Record<string, unknown>) => ({ title: String(job.title).trim(), company, location: job.location ? String(job.location) : null, description: job.description ? String(job.description) : null, skills: [], job_type: job.job_type ? String(job.job_type) : null, work_mode: job.work_mode ? String(job.work_mode) : null, experience_level: null, salary_min: null, salary_max: null, salary_currency: null, source: "company_career", source_job_id: job.id ? String(job.id) : job.url ? String(job.url) : null, source_url: job.url ? String(job.url) : url, recruiter_id: null, posted_at: job.posted_at ? String(job.posted_at) : null }));
}

export async function collectCompanyCareerJobs(url: string, company: string): Promise<NormalizedJob[]> {
  const token = Deno.env.get("FIRECRAWL_API_TOKEN");
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), COMPANY_CAREER_ATTEMPT_MS);
  const publicPage = collectPublicCareerLinks(url, company, controller.signal);

  try {
    // Start both strategies at once. Static company pages usually finish first;
    // JavaScript-based ATS pages can still be handled by Firecrawl. This avoids
    // the former 20s Firecrawl wait followed by a second 20s page wait.
    return token
      ? await Promise.any([collectWithFirecrawl(url, company, token, controller.signal), publicPage])
      : await publicPage;
  } catch (error) {
    if (isAbortError(error) || controller.signal.aborted) {
      throw new Error(`Company careers source timed out after ${COMPANY_CAREER_ATTEMPT_MS / 1_000} seconds`);
    }
    throw error instanceof AggregateError
      ? new Error("Company careers page has no accessible current openings")
      : error;
  } finally {
    clearTimeout(timeoutId);
    controller.abort();
  }
}
