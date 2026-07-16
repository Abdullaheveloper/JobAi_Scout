import type { NormalizedJob } from "../job-collection.ts";
import { runApifyActor } from "./apify.ts";

export async function collectLinkedInJobs(keywords: string[], locations: string[], maxItems = 25): Promise<NormalizedJob[]> {
  const actor = Deno.env.get("APIFY_LINKEDIN_ACTOR"); if (!actor) throw new Error("APIFY_LINKEDIN_ACTOR is missing");
  const cookies = Deno.env.get("LINKEDIN_COOKIES_JSON");
  if (!cookies) throw new Error("LINKEDIN_COOKIES_JSON is required by the selected LinkedIn actor");
  let parsedCookies: unknown[]; try { parsedCookies = JSON.parse(cookies); } catch { throw new Error("LINKEDIN_COOKIES_JSON must be a JSON cookie array"); }
  const keyword = keywords.filter(Boolean).join(" OR "); const location = locations.filter(Boolean)[0] || "";
  const searchUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(keyword)}&location=${encodeURIComponent(location)}`;
  const items = await runApifyActor(actor, { cookies: parsedCookies, userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", searchUrl, scrapeJobDetails: true, scrapeSkills: true, scrapeCompany: false, count: maxItems });
  return items.map((item) => ({ title: String(item.jobTitle || item.title || ""), company: String(item.company || item.companyName || ""), location: item.location ? String(item.location) : null, description: item.description ? String(item.description) : null, skills: Array.isArray(item.skills) ? item.skills.map(String) : [], job_type: item.jobType ? String(item.jobType) : item.employmentType ? String(item.employmentType) : null, work_mode: item.workplaceType ? String(item.workplaceType) : null, experience_level: item.seniorityLevel ? String(item.seniorityLevel) : null, salary_min: null, salary_max: null, salary_currency: null, source: "linkedin_apify", source_job_id: item.jobId ? String(item.jobId) : item.id ? String(item.id) : null, source_url: item.jobUrl ? String(item.jobUrl) : item.url ? String(item.url) : null, recruiter_id: null, posted_at: item.postedDate ? String(item.postedDate) : null }));
}
