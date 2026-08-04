-- Browse Jobs returns recruiter postings plus this user's accepted scrape
-- results. The current profile threshold (40 by default) is enforced again
-- at read time so lowering/raising preferences is reflected immediately.
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
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  WITH preference AS (
    SELECT LEAST(100, GREATEST(0, COALESCE(profile.min_match_threshold, 40)))::INTEGER AS threshold
    FROM public.profiles profile WHERE profile.user_id = auth.uid()
    UNION ALL SELECT 40 WHERE NOT EXISTS (SELECT 1 FROM public.profiles profile WHERE profile.user_id = auth.uid())
    LIMIT 1
  ), eligible AS (
    SELECT job.*, matched.session_id, matched.match_score AS user_match_score,
      matched.match_explanation AS user_match_explanation, matched.adapter_order,
      matched.source_result_order, matched.scraped_at
    FROM public.jobs job
    CROSS JOIN preference
    LEFT JOIN LATERAL (
      SELECT result.session_id, result.match_score, result.match_explanation,
        result.adapter_order, result.source_result_order, result.scraped_at
      FROM public.job_scrape_results result
      WHERE result.job_id = job.id AND result.user_id = auth.uid()
        AND result.match_score >= preference.threshold
      ORDER BY result.scraped_at DESC LIMIT 1
    ) matched ON true
    WHERE COALESCE(job.is_active, true) = true
      AND COALESCE(job.status, 'active') = 'active'
      AND (job.recruiter_id IS NOT NULL OR matched.session_id IS NOT NULL)
  )
  SELECT eligible.id, eligible.session_id, eligible.title, eligible.company,
    eligible.location, eligible.description, eligible.skills, eligible.job_type,
    eligible.employment_type, eligible.work_mode, eligible.source,
    COALESCE(eligible.source_url, eligible.job_url), eligible.recruiter_id,
    eligible.salary_min, eligible.salary_max, eligible.salary_currency,
    COALESCE(eligible.posted_at, eligible.date_posted), eligible.created_at,
    eligible.user_match_score, eligible.user_match_explanation,
    eligible.adapter_order, eligible.source_result_order, eligible.scraped_at,
    count(*) OVER ()
  FROM eligible
  WHERE (NULLIF(trim(p_query), '') IS NULL
      OR eligible.title ILIKE '%' || trim(p_query) || '%'
      OR eligible.company ILIKE '%' || trim(p_query) || '%'
      OR COALESCE(eligible.location, '') ILIKE '%' || trim(p_query) || '%'
      OR COALESCE(array_to_string(eligible.skills, ' '), '') ILIKE '%' || trim(p_query) || '%'
      OR COALESCE(eligible.description, '') ILIKE '%' || trim(p_query) || '%')
    AND (NULLIF(trim(p_location), '') IS NULL OR COALESCE(eligible.location, '') ILIKE '%' || trim(p_location) || '%')
    AND (p_job_type IS NULL OR lower(COALESCE(eligible.job_type, eligible.employment_type, '')) = lower(p_job_type))
    AND (p_work_mode IS NULL OR lower(COALESCE(eligible.work_mode, '') || ' ' || COALESCE(eligible.location, '')) LIKE '%' || lower(p_work_mode) || '%')
  ORDER BY CASE WHEN NULLIF(trim(p_query), '') IS NOT NULL AND lower(eligible.title) LIKE lower(trim(p_query)) || '%' THEN 0 ELSE 1 END,
    COALESCE(eligible.posted_at, eligible.date_posted, eligible.created_at) DESC NULLS LAST
  LIMIT LEAST(GREATEST(p_limit, 1), 50) OFFSET GREATEST(p_offset, 0);
$$;
