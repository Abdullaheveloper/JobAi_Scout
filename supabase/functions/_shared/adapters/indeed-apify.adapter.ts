import type { NormalizedJob } from "../job-collection.ts";
import { runApifyActor } from "./apify.ts";

function normalizeItems(items: Record<string, unknown>[]): NormalizedJob[] {
  return items.map((item) => ({ title: String(item.positionName || item.title || ""), company: String(item.company || item.companyName || ""), location: item.location ? String(item.location) : null, description: item.description ? String(item.description) : null, skills: Array.isArray(item.skills) ? item.skills.map(String) : [], job_type: Array.isArray(item.jobType) ? item.jobType.join(", ") : item.jobType ? String(item.jobType) : null, work_mode: null, experience_level: null, salary_min: null, salary_max: null, salary_currency: null, source: "indeed_apify", source_job_id: item.id ? String(item.id) : item.url ? String(item.url) : null, source_url: item.externalApplyLink ? String(item.externalApplyLink) : item.applyUrl ? String(item.applyUrl) : item.apply_url ? String(item.apply_url) : item.url ? String(item.url) : item.jobUrl ? String(item.jobUrl) : null, recruiter_id: null, posted_at: item.postingDateParsed ? String(item.postingDateParsed) : null }));
}

export async function collectIndeedJobs(query: string, location: string, maxItems = 10, signal?: AbortSignal, onJobs?: (jobs: NormalizedJob[]) => void): Promise<NormalizedJob[]> {
  const actor = Deno.env.get("APIFY_INDEED_ACTOR"); if (!actor) throw new Error("APIFY_INDEED_ACTOR is missing");
  const items = await runApifyActor(actor, { position: query, location, country: "PK", maxItemsPerSearch: maxItems, saveOnlyUniqueItems: true, parseCompanyDetails: false, followApplyRedirects: false }, { signal, onItems: (partial) => onJobs?.(normalizeItems(partial)) });
  return normalizeItems(items);
}
