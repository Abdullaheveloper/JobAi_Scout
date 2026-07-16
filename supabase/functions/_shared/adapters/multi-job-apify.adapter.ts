import type { NormalizedJob } from "../job-collection.ts";
import { runApifyActor } from "./apify.ts";

export async function collectMultiBoardJobs(query: string, location: string): Promise<NormalizedJob[]> {
  const actor = Deno.env.get("APIFY_MULTI_JOB_ACTOR"); if (!actor) throw new Error("APIFY_MULTI_JOB_ACTOR is missing");
  const items = await runApifyActor(actor, { searchTerm: query, location, sites: ["linkedin", "indeed", "glassdoor", "google"], maxResults: 10, isRemote: false });
  return items.map((item) => ({ title: String(item.title || item.jobTitle || ""), company: String(item.company || item.companyName || ""), location: item.location ? String(item.location) : null, description: item.description ? String(item.description) : null, skills: Array.isArray(item.skills) ? item.skills.map(String) : [], job_type: item.jobType ? String(item.jobType) : null, work_mode: item.isRemote ? "remote" : null, experience_level: item.experienceLevel ? String(item.experienceLevel) : null, salary_min: null, salary_max: null, salary_currency: null, source: `multi_${String(item.site || item.source || "job_board").toLowerCase()}`, source_job_id: item.id ? String(item.id) : item.jobId ? String(item.jobId) : item.url ? String(item.url) : null, source_url: item.url ? String(item.url) : item.jobUrl ? String(item.jobUrl) : null, recruiter_id: null, posted_at: item.postedAt ? String(item.postedAt) : null }));
}
