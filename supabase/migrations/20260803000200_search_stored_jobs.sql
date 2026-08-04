-- Search the durable jobs catalog only. This function never starts a scrape.
CREATE OR REPLACE FUNCTION public.search_stored_jobs(
  p_query TEXT DEFAULT NULL,
  p_location TEXT DEFAULT NULL,
  p_job_type TEXT DEFAULT NULL,
  p_work_mode TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 30,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID, session_id UUID, title TEXT, company TEXT, location TEXT,
  description TEXT, skills TEXT[], job_type TEXT, employment_type TEXT,
  work_mode TEXT, source TEXT, source_url TEXT, recruiter_id UUID,
  salary_min INTEGER, salary_max INTEGER, salary_currency TEXT,
  posted_at TIMESTAMPTZ, created_at TIMESTAMPTZ, match_score INTEGER,
  match_explanation JSONB, adapter_order SMALLINT, source_result_order INTEGER,
  scraped_at TIMESTAMPTZ, total_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    job.id,
    NULL::UUID AS session_id,
    job.title, job.company, job.location, job.description, job.skills,
    job.job_type, job.employment_type, job.work_mode, job.source,
    COALESCE(job.source_url, job.job_url) AS source_url,
    job.recruiter_id, job.salary_min, job.salary_max, job.salary_currency,
    COALESCE(job.posted_at, job.date_posted) AS posted_at,
    job.created_at, job.match_score, job.match_explanation,
    NULL::SMALLINT AS adapter_order,
    NULL::INTEGER AS source_result_order,
    job.collected_at AS scraped_at,
    count(*) OVER () AS total_count
  FROM public.jobs job
  WHERE COALESCE(job.is_active, true) = true
    AND COALESCE(job.status, 'active') = 'active'
    AND (
      NULLIF(trim(p_query), '') IS NULL
      OR job.title ILIKE '%' || trim(p_query) || '%'
      OR job.company ILIKE '%' || trim(p_query) || '%'
      OR COALESCE(job.location, '') ILIKE '%' || trim(p_query) || '%'
      OR COALESCE(array_to_string(job.skills, ' '), '') ILIKE '%' || trim(p_query) || '%'
      OR COALESCE(job.description, '') ILIKE '%' || trim(p_query) || '%'
    )
    AND (NULLIF(trim(p_location), '') IS NULL OR COALESCE(job.location, '') ILIKE '%' || trim(p_location) || '%')
    AND (p_job_type IS NULL OR lower(COALESCE(job.job_type, job.employment_type, '')) = lower(p_job_type))
    AND (p_work_mode IS NULL OR lower(COALESCE(job.work_mode, '') || ' ' || COALESCE(job.location, '')) LIKE '%' || lower(p_work_mode) || '%')
  ORDER BY
    CASE WHEN NULLIF(trim(p_query), '') IS NOT NULL AND lower(job.title) LIKE lower(trim(p_query)) || '%' THEN 0 ELSE 1 END,
    COALESCE(job.posted_at, job.date_posted, job.created_at) DESC NULLS LAST
  LIMIT LEAST(GREATEST(p_limit, 1), 50)
  OFFSET GREATEST(p_offset, 0);
$$;

GRANT EXECUTE ON FUNCTION public.search_stored_jobs(TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER) TO authenticated;

CREATE INDEX IF NOT EXISTS jobs_active_posted_idx
  ON public.jobs ((COALESCE(posted_at, date_posted, created_at)) DESC)
  WHERE COALESCE(is_active, true) = true AND COALESCE(status, 'active') = 'active';

CREATE INDEX IF NOT EXISTS jobs_title_trgm_idx ON public.jobs USING gin (title extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS jobs_company_trgm_idx ON public.jobs USING gin (company extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS jobs_location_trgm_idx ON public.jobs USING gin (location extensions.gin_trgm_ops);
