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

function normalizeTimestamp(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
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
    posted_at: normalizeTimestamp(raw.posted_at) };
}

export function deduplicateJobs(jobs: NormalizedJob[]): NormalizedJob[] {
  const seen = new Set<string>();
  return jobs.filter((job) => {
    const normalized = normalizeJob(job);
    if (!normalized) return true;
    const identity = normalized.source_url?.toLowerCase() || duplicateKey(normalized);
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

export async function upsertCollectedJobs(jobs: NormalizedJob[]) {
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let inserted = 0; let updated = 0; let skipped = 0;
  for (const job of jobs) {
    const normalized = normalizeJob(job); if (!normalized) { skipped++; continue; }
    const key = duplicateKey(normalized);
    // The same role can be returned by dedicated and multi-board adapters.
    // Check all stable identities before inserting so the global source_url
    // constraint never turns a harmless duplicate into a failed collection.
    let existing: { id: string; source: string; source_job_id: string | null } | null = null;
    const lookups = [
      normalized.source_job_id
        ? supabase.from("jobs").select("id, source, source_job_id").eq("source", normalized.source).eq("source_job_id", normalized.source_job_id).limit(1).maybeSingle()
        : null,
      normalized.source_url
        ? supabase.from("jobs").select("id, source, source_job_id").eq("source_url", normalized.source_url).limit(1).maybeSingle()
        : null,
      supabase.from("jobs").select("id, source, source_job_id").eq("duplicate_key", key).limit(1).maybeSingle(),
    ].filter(Boolean) as Array<PromiseLike<{ data: { id: string; source: string; source_job_id: string | null } | null; error: { message: string } | null }>>;

    for (const lookup of lookups) {
      const { data, error: findError } = await lookup;
      if (findError) throw new Error(`Job lookup failed: ${findError.message}`);
      if (data) { existing = data; break; }
    }
    const record = { ...normalized, duplicate_key: key, job_url: normalized.source_url, date_posted: normalized.posted_at,
      collected_at: new Date().toISOString(), last_seen_at: new Date().toISOString(), status: "active", is_active: true };
    // Attribute a refreshed role to the source currently being collected. This
    // ensures a job returned by RSS or Company Careers is visible immediately
    // when the user has that same source filter selected.
    const result = existing ? await supabase.from("jobs").update(record).eq("id", existing.id) : await supabase.from("jobs").insert(record);
    if (result.error) throw new Error(`Job save failed: ${result.error.message}`);
    if (existing) updated++; else inserted++;
  }
  return { inserted, updated, skipped };
}
