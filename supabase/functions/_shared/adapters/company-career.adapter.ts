import type { NormalizedJob } from "../job-collection.ts";

export async function collectCompanyCareerJobs(url: string, company: string): Promise<NormalizedJob[]> {
  const token = Deno.env.get("FIRECRAWL_API_TOKEN"); if (!token) throw new Error("FIRECRAWL_API_TOKEN is missing");
  const schema = { type: "object", properties: { jobs: { type: "array", items: { type: "object", properties: { title: { type: "string" }, location: { type: "string" }, description: { type: "string" }, url: { type: "string" }, job_type: { type: "string" }, work_mode: { type: "string" }, posted_at: { type: "string" } }, required: ["title"] } } }, required: ["jobs"] };
  const response = await fetch("https://api.firecrawl.dev/v2/scrape", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ url, formats: [{ type: "json", schema, prompt: "Extract only current job openings from this official company careers page. Do not invent values." }], onlyMainContent: true }), signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Company career scrape failed (${response.status}): ${await response.text()}`);
  const data = await response.json(); const jobs = data?.data?.json?.jobs || data?.json?.jobs || [];
  return jobs.map((job: Record<string, unknown>) => ({ title: String(job.title || ""), company, location: job.location ? String(job.location) : null, description: job.description ? String(job.description) : null, skills: [], job_type: job.job_type ? String(job.job_type) : null, work_mode: job.work_mode ? String(job.work_mode) : null, experience_level: null, salary_min: null, salary_max: null, salary_currency: null, source: "company_career", source_job_id: job.id ? String(job.id) : job.url ? String(job.url) : null, source_url: job.url ? String(job.url) : url, recruiter_id: null, posted_at: job.posted_at ? String(job.posted_at) : null }));
}
