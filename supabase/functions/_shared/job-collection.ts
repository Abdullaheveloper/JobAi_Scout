import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type NormalizedJob = {
  title: string; company: string; location: string | null; description: string | null;
  skills: string[]; job_type: string | null; work_mode: string | null;
  experience_level: string | null; salary_min: number | null; salary_max: number | null;
  salary_currency: string | null; source: string; source_job_id: string | null;
  source_url: string | null; recruiter_id: string | null; posted_at: string | null;
};

export function duplicateKey(job: NormalizedJob): string {
  return `${job.title}|${job.company}|${job.location || ""}`.toLowerCase().replace(/\s+/g, " ").trim();
}

export function normalizeJob(raw: Partial<NormalizedJob>): NormalizedJob | null {
  const title = raw.title?.trim(); const company = raw.company?.trim();
  if (!title || !company || !raw.source) return null;
  const sourceUrl = raw.source_url?.trim() || null;
  // Scraped jobs must lead to a real, external posting. Recruiter jobs are handled
  // inside the app and therefore do not require an external URL.
  if (!raw.recruiter_id && (!sourceUrl || !/^https?:\/\//i.test(sourceUrl))) return null;
  return { title, company, location: raw.location?.trim() || null, description: raw.description?.trim() || null,
    skills: [...new Set((raw.skills || []).map((skill) => skill.trim()).filter(Boolean))], job_type: raw.job_type || null,
    work_mode: raw.work_mode || null, experience_level: raw.experience_level || null, salary_min: raw.salary_min ?? null,
    salary_max: raw.salary_max ?? null, salary_currency: raw.salary_currency || null, source: raw.source,
    source_job_id: raw.source_job_id || null, source_url: sourceUrl, recruiter_id: raw.recruiter_id || null,
    posted_at: raw.posted_at || null };
}

export async function upsertCollectedJobs(jobs: NormalizedJob[]) {
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let inserted = 0; let updated = 0; let skipped = 0;
  for (const job of jobs) {
    const normalized = normalizeJob(job); if (!normalized) { skipped++; continue; }
    const key = duplicateKey(normalized);
    let query = supabase.from("jobs").select("id").limit(1);
    if (normalized.source_job_id) query = query.eq("source", normalized.source).eq("source_job_id", normalized.source_job_id);
    else if (normalized.source_url) query = query.eq("source_url", normalized.source_url);
    else query = query.eq("duplicate_key", key);
    const { data: existing, error: findError } = await query.maybeSingle();
    if (findError) throw new Error(`Job lookup failed: ${findError.message}`);
    const record = { ...normalized, duplicate_key: key, job_url: normalized.source_url, date_posted: normalized.posted_at,
      collected_at: new Date().toISOString(), last_seen_at: new Date().toISOString(), status: "active", is_active: true };
    const result = existing ? await supabase.from("jobs").update(record).eq("id", existing.id) : await supabase.from("jobs").insert(record);
    if (result.error) throw new Error(`Job save failed: ${result.error.message}`);
    if (existing) updated++; else inserted++;
  }
  return { inserted, updated, skipped };
}
