-- The Recruiter Jobs experience combines direct recruiter postings with the
-- current user's accepted, durably saved scrape results. It never scrapes.
CREATE OR REPLACE FUNCTION public.search_recruiter_and_saved_jobs(
  p_query TEXT DEFAULT NULL,
  p_title TEXT DEFAULT NULL,
  p_company TEXT DEFAULT NULL,
  p_location TEXT DEFAULT NULL,
  p_job_type TEXT DEFAULT NULL,
  p_experience_level TEXT DEFAULT NULL,
  p_salary_min INTEGER DEFAULT NULL,
  p_salary_max INTEGER DEFAULT NULL,
  p_posted_days INTEGER DEFAULT NULL,
  p_limit INTEGER DEFAULT 12,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (job JSONB, total_count BIGINT)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  WITH preference AS (
    SELECT LEAST(100, GREATEST(0, COALESCE(profile.min_match_threshold, 40)))::INTEGER AS threshold
    FROM public.profiles profile WHERE profile.user_id = auth.uid()
    UNION ALL SELECT 40 WHERE NOT EXISTS (SELECT 1 FROM public.profiles profile WHERE profile.user_id = auth.uid())
    LIMIT 1
  ), eligible AS (
    SELECT posting.*
    FROM public.jobs posting CROSS JOIN preference
    WHERE COALESCE(posting.is_active, true) = true
      AND COALESCE(posting.status, 'active') = 'active'
      AND (posting.recruiter_id IS NOT NULL OR EXISTS (
        SELECT 1 FROM public.job_scrape_results result
        WHERE result.job_id = posting.id AND result.user_id = auth.uid()
          AND result.match_score >= preference.threshold
      ))
      AND (NULLIF(trim(p_query), '') IS NULL
        OR posting.title ILIKE '%' || trim(p_query) || '%'
        OR posting.company ILIKE '%' || trim(p_query) || '%'
        OR COALESCE(posting.location, '') ILIKE '%' || trim(p_query) || '%'
        OR COALESCE(array_to_string(posting.skills, ' '), '') ILIKE '%' || trim(p_query) || '%'
        OR COALESCE(posting.description, '') ILIKE '%' || trim(p_query) || '%')
      AND (NULLIF(trim(p_title), '') IS NULL OR posting.title ILIKE '%' || trim(p_title) || '%')
      AND (NULLIF(trim(p_company), '') IS NULL OR posting.company ILIKE '%' || trim(p_company) || '%')
      AND (NULLIF(trim(p_location), '') IS NULL OR COALESCE(posting.location, '') ILIKE '%' || trim(p_location) || '%')
      AND (p_job_type IS NULL OR lower(COALESCE(posting.job_type, posting.employment_type, '')) = lower(p_job_type)
        OR (lower(p_job_type) = 'remote' AND lower(COALESCE(posting.work_mode, '') || ' ' || COALESCE(posting.location, '')) LIKE '%remote%'))
      AND (p_experience_level IS NULL OR lower(COALESCE(posting.experience_level, '')) = lower(p_experience_level))
      AND (p_salary_min IS NULL OR posting.salary_max >= p_salary_min)
      AND (p_salary_max IS NULL OR posting.salary_min <= p_salary_max)
      AND (p_posted_days IS NULL OR COALESCE(posting.posted_at, posting.date_posted, posting.created_at) >= now() - make_interval(days => p_posted_days))
  )
  SELECT to_jsonb(eligible), count(*) OVER ()
  FROM eligible
  ORDER BY CASE WHEN NULLIF(trim(p_query), '') IS NOT NULL AND lower(eligible.title) LIKE lower(trim(p_query)) || '%' THEN 0 ELSE 1 END,
    COALESCE(eligible.posted_at, eligible.date_posted, eligible.created_at) DESC NULLS LAST
  LIMIT LEAST(GREATEST(p_limit, 1), 50) OFFSET GREATEST(p_offset, 0);
$$;

REVOKE ALL ON FUNCTION public.search_recruiter_and_saved_jobs(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_recruiter_and_saved_jobs(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER) TO authenticated;
