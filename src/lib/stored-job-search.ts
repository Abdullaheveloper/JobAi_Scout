export type SearchableStoredJob = {
  title: string;
  company?: string | null;
  location?: string | null;
  description?: string | null;
  skills?: string[] | null;
  recruiter_id?: string | null;
};

export function matchesStoredJobQuery(job: SearchableStoredJob, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return true;
  return [job.title, job.company, job.location, job.description, ...(job.skills || [])]
    .some((value) => String(value || "").toLocaleLowerCase().includes(needle));
}

export function isStoredJobEligible(
  job: SearchableStoredJob,
  userMatchScore: number | null | undefined,
  threshold = 40,
): boolean {
  return Boolean(job.recruiter_id) || Number(userMatchScore ?? -1) >= Math.min(100, Math.max(0, threshold));
}
