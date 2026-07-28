-- Job matching preferences: category weights, threshold, first-run flag.
-- Sparse match_weights: only set keys count; unset treated as 0% client-side.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS match_weights JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS min_match_threshold INTEGER NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS has_set_match_preferences BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_min_match_threshold_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_min_match_threshold_check
      CHECK (min_match_threshold >= 0 AND min_match_threshold <= 100);
  END IF;
END $$;

COMMENT ON COLUMN public.profiles.match_weights IS
  'Sparse map of match category keys to percentage weights (0-100). Unset keys count as 0.';
COMMENT ON COLUMN public.profiles.min_match_threshold IS
  'Minimum match score (0-100) required to show a job. Default 40.';
COMMENT ON COLUMN public.profiles.has_set_match_preferences IS
  'True after the user completes first-run job matching setup. Default false.';

-- Allow RPC consumers to pass the caller's threshold (default 40 for back-compat).
DROP FUNCTION IF EXISTS public.search_scrape_session_jobs(UUID, TEXT[], TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, BOOLEAN);

CREATE OR REPLACE FUNCTION public.search_scrape_session_jobs(
  p_session_id UUID,
  p_terms TEXT[],
  p_source TEXT,
  p_location TEXT,
  p_job_type TEXT,
  p_work_mode TEXT,
  p_limit INTEGER,
  p_offset INTEGER,
  p_include_remote BOOLEAN DEFAULT false,
  p_min_match_score INTEGER DEFAULT 40
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
  WITH normalized_terms AS (
    SELECT ARRAY(
      SELECT DISTINCT lower(trim(term))
      FROM unnest(COALESCE(p_terms, ARRAY[]::TEXT[])) AS term
      WHERE length(trim(term)) >= 2
      LIMIT 8
    ) AS terms
  ), target_session AS (
    SELECT session.id
    FROM public.job_scrape_sessions session
    WHERE session.user_id = auth.uid()
      AND (p_session_id IS NULL OR session.id = p_session_id)
    ORDER BY session.started_at DESC
    LIMIT 1
  ), eligible AS (
    SELECT result.session_id, result.job_id, result.match_score,
      result.match_explanation, result.adapter_order, result.source_result_order,
      result.published_at, result.scraped_at, job.title, job.company,
      job.location, job.description, job.skills, job.job_type,
      job.employment_type, job.work_mode, job.source, job.source_url,
      job.recruiter_id, job.salary_min, job.salary_max, job.salary_currency,
      job.posted_at, job.created_at AS job_created_at
    FROM public.job_scrape_results result
    JOIN target_session target ON target.id = result.session_id
    JOIN public.jobs job ON job.id = result.job_id
    CROSS JOIN normalized_terms nt
    WHERE result.user_id = auth.uid()
      AND result.match_score >= LEAST(GREATEST(COALESCE(p_min_match_score, 40), 0), 100)
      AND job.is_active = true
      AND job.status = 'active'
      AND (p_source IS NULL OR job.source = p_source)
      AND (
        p_location IS NULL
        OR lower(COALESCE(job.location, '')) LIKE '%' || lower(p_location) || '%'
        OR (p_include_remote AND (
          lower(COALESCE(job.work_mode, '')) LIKE '%remote%'
          OR lower(COALESCE(job.location, '')) LIKE '%remote%'
          OR lower(COALESCE(job.location, '')) LIKE '%pakistan%'
        ))
      )
      AND (p_job_type IS NULL OR lower(COALESCE(job.job_type, job.employment_type, '')) LIKE '%' || lower(p_job_type) || '%')
      AND (p_work_mode IS NULL OR lower(COALESCE(job.work_mode, '') || ' ' || COALESCE(job.location, '')) LIKE '%' || lower(p_work_mode) || '%')
      AND (
        cardinality(nt.terms) = 0 OR EXISTS (
          SELECT 1 FROM unnest(nt.terms) term
          WHERE lower(COALESCE(job.title, '')) LIKE '%' || term || '%'
             OR lower(COALESCE(job.company, '')) LIKE '%' || term || '%'
             OR lower(COALESCE(array_to_string(job.skills, ' '), '')) LIKE '%' || term || '%'
             OR lower(COALESCE(job.description, '')) LIKE '%' || term || '%'
        )
      )
  )
  SELECT eligible.job_id, eligible.session_id, eligible.title, eligible.company,
    eligible.location, eligible.description, eligible.skills, eligible.job_type,
    eligible.employment_type, eligible.work_mode, eligible.source,
    eligible.source_url, eligible.recruiter_id, eligible.salary_min,
    eligible.salary_max, eligible.salary_currency, eligible.posted_at,
    eligible.job_created_at, eligible.match_score, eligible.match_explanation,
    eligible.adapter_order, eligible.source_result_order, eligible.scraped_at,
    count(*) OVER () AS total_count
  FROM eligible
  ORDER BY eligible.match_score DESC,
    eligible.adapter_order ASC,
    COALESCE(eligible.published_at, eligible.posted_at) DESC NULLS LAST,
    eligible.scraped_at DESC, eligible.source_result_order ASC
  LIMIT LEAST(GREATEST(p_limit, 1), 30)
  OFFSET GREATEST(p_offset, 0);
$$;

GRANT EXECUTE ON FUNCTION public.search_scrape_session_jobs(UUID, TEXT[], TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, BOOLEAN, INTEGER) TO authenticated;
