import type { NormalizedJob } from "../job-collection.ts";
import { runApifyActor } from "./apify.ts";

type LinkedInFilters = { jobType?: string; workMode?: string };

export async function collectLinkedInJobs(keywords: string[], locations: string[], maxItems = 25, filters: LinkedInFilters = {}): Promise<NormalizedJob[]> {
  const actor = Deno.env.get("APIFY_LINKEDIN_ACTOR"); if (!actor) throw new Error("APIFY_LINKEDIN_ACTOR is missing");
  const jobTypes: Record<string, string> = { "full-time": "fulltime", "part-time": "parttime", contract: "contract", internship: "internship" };
  const input = {
    searchTerm: keywords.filter(Boolean).join(" OR "),
    locations: locations.filter(Boolean),
    postedWithin: "30d",
    distance: 25,
    sortBy: "date",
    maxItems,
    maxPagesPerSearch: 2,
    balanceKeywordCoverage: true,
    saveOnlyUniqueItems: true,
    fetchJobDetails: true,
    jobType: jobTypes[String(filters.jobType || "").toLowerCase()] || "any",
    workplaceType: ["remote", "hybrid"].includes(String(filters.workMode || "").toLowerCase()) ? String(filters.workMode).toLowerCase() : "any",
    experienceLevel: "any",
  };
  const items = await runApifyActor(actor, input);
  return items.map((item) => ({ title: String(item.title || item.jobTitle || ""), company: String(item.companyName || item.company || ""), location: item.locationRaw ? String(item.locationRaw) : item.location ? String(item.location) : null, description: item.descriptionText ? String(item.descriptionText) : item.description ? String(item.description) : null, skills: Array.isArray(item.skills) ? item.skills.map(String) : [], job_type: item.employmentType ? String(item.employmentType) : item.jobType ? String(item.jobType) : null, work_mode: item.workplaceType ? String(item.workplaceType) : item.isRemote ? "remote" : null, experience_level: item.seniority ? String(item.seniority) : item.seniorityLevel ? String(item.seniorityLevel) : null, salary_min: typeof item.salaryMin === "number" ? item.salaryMin : null, salary_max: typeof item.salaryMax === "number" ? item.salaryMax : null, salary_currency: item.salaryCurrency ? String(item.salaryCurrency) : null, source: "linkedin_apify", source_job_id: item.jobId ? String(item.jobId) : item.id ? String(item.id) : null, source_url: item.jobUrl ? String(item.jobUrl) : item.url ? String(item.url) : null, recruiter_id: null, posted_at: item.postedAt ? String(item.postedAt) : item.postedDate ? String(item.postedDate) : null }));
}
