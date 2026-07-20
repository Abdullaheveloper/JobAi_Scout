-- User-owned orchestration state for the existing global jobs catalogue.
-- Jobs remain globally deduplicated so saved_jobs and recruiter relations stay intact;
-- per-user scores and source ordering live in job_scrape_results.
CREATE TABLE IF NOT EXISTS public.job_scrape_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  search_query TEXT NOT NULL CHECK (length(search_query) BETWEEN 1 AND 120),
  location TEXT,
  current_adapter TEXT CHECK (current_adapter IS NULL OR current_adapter IN ('linkedin', 'indeed', 'rss', 'company_career')),
  session_status TEXT NOT NULL DEFAULT 'pending' CHECK (session_status IN ('pending', 'running', 'completed', 'partially_completed', 'failed')),
  adapter_statuses JSONB NOT NULL DEFAULT jsonb_build_object(
    'linkedin', 'waiting',
    'indeed', 'waiting',
    'rss', 'waiting',
    'company_career', 'waiting'
  ),
  adapter_errors JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_jobs_scraped INTEGER NOT NULL DEFAULT 0 CHECK (total_jobs_scraped >= 0),
  total_jobs_saved INTEGER NOT NULL DEFAULT 0 CHECK (total_jobs_saved >= 0),
  total_jobs_displayed INTEGER NOT NULL DEFAULT 0 CHECK (total_jobs_displayed >= 0),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_job_scrape_session_per_user
  ON public.job_scrape_sessions (user_id)
  WHERE session_status IN ('pending', 'running');

CREATE INDEX IF NOT EXISTS job_scrape_sessions_user_started_idx
  ON public.job_scrape_sessions (user_id, started_at DESC);

ALTER TABLE public.job_scrape_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own job scrape sessions"
  ON public.job_scrape_sessions FOR SELECT
  USING (auth.uid() = user_id);
GRANT SELECT ON public.job_scrape_sessions TO authenticated;
GRANT ALL ON public.job_scrape_sessions TO service_role;

DROP TRIGGER IF EXISTS update_job_scrape_sessions_updated_at ON public.job_scrape_sessions;
CREATE TRIGGER update_job_scrape_sessions_updated_at
  BEFORE UPDATE ON public.job_scrape_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.job_scrape_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.job_scrape_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  match_score INTEGER NOT NULL CHECK (match_score BETWEEN 0 AND 100),
  match_explanation JSONB NOT NULL DEFAULT '{}'::jsonb,
  adapter_order SMALLINT NOT NULL CHECK (adapter_order BETWEEN 1 AND 4),
  source_result_order INTEGER NOT NULL CHECK (source_result_order >= 0),
  published_at TIMESTAMPTZ,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, job_id)
);

CREATE INDEX IF NOT EXISTS job_scrape_results_session_order_idx
  ON public.job_scrape_results (session_id, adapter_order, published_at DESC, scraped_at DESC);
CREATE INDEX IF NOT EXISTS job_scrape_results_user_score_idx
  ON public.job_scrape_results (user_id, match_score DESC);

ALTER TABLE public.job_scrape_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own job scrape results"
  ON public.job_scrape_results FOR SELECT
  USING (auth.uid() = user_id);
GRANT SELECT ON public.job_scrape_results TO authenticated;
GRANT ALL ON public.job_scrape_results TO service_role;

CREATE OR REPLACE FUNCTION public.search_scrape_session_jobs(
  p_session_id UUID DEFAULT NULL,
  p_terms TEXT[] DEFAULT ARRAY[]::TEXT[],
  p_source TEXT DEFAULT NULL,
  p_location TEXT DEFAULT NULL,
  p_job_type TEXT DEFAULT NULL,
  p_work_mode TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 30,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  session_id UUID,
  title TEXT,
  company TEXT,
  location TEXT,
  description TEXT,
  skills TEXT[],
  job_type TEXT,
  employment_type TEXT,
  work_mode TEXT,
  source TEXT,
  source_url TEXT,
  recruiter_id UUID,
  salary_min INTEGER,
  salary_max INTEGER,
  salary_currency TEXT,
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  match_score INTEGER,
  match_explanation JSONB,
  adapter_order SMALLINT,
  source_result_order INTEGER,
  scraped_at TIMESTAMPTZ,
  total_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
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
    SELECT
      result.session_id,
      result.job_id,
      result.match_score,
      result.match_explanation,
      result.adapter_order,
      result.source_result_order,
      result.published_at,
      result.scraped_at,
      job.title,
      job.company,
      job.location,
      job.description,
      job.skills,
      job.job_type,
      job.employment_type,
      job.work_mode,
      job.source,
      job.source_url,
      job.recruiter_id,
      job.salary_min,
      job.salary_max,
      job.salary_currency,
      job.posted_at,
      job.created_at AS job_created_at
    FROM public.job_scrape_results result
    JOIN target_session target ON target.id = result.session_id
    JOIN public.jobs job ON job.id = result.job_id
    CROSS JOIN normalized_terms nt
    WHERE result.user_id = auth.uid()
      AND result.match_score >= 60
      AND job.is_active = true
      AND job.status = 'active'
      AND (p_source IS NULL OR job.source = p_source)
      AND (p_location IS NULL OR lower(COALESCE(job.location, '')) LIKE '%' || lower(p_location) || '%')
      AND (p_job_type IS NULL OR lower(COALESCE(job.job_type, job.employment_type, '')) LIKE '%' || lower(p_job_type) || '%')
      AND (p_work_mode IS NULL OR lower(COALESCE(job.work_mode, '') || ' ' || COALESCE(job.location, '')) LIKE '%' || lower(p_work_mode) || '%')
      AND (
        cardinality(nt.terms) = 0 OR EXISTS (
          SELECT 1
          FROM unnest(nt.terms) term
          WHERE lower(COALESCE(job.title, '')) LIKE '%' || term || '%'
             OR lower(COALESCE(job.company, '')) LIKE '%' || term || '%'
             OR lower(COALESCE(array_to_string(job.skills, ' '), '')) LIKE '%' || term || '%'
             OR lower(COALESCE(job.description, '')) LIKE '%' || term || '%'
        )
      )
  )
  SELECT
    eligible.job_id,
    eligible.session_id,
    eligible.title,
    eligible.company,
    eligible.location,
    eligible.description,
    eligible.skills,
    eligible.job_type,
    eligible.employment_type,
    eligible.work_mode,
    eligible.source,
    eligible.source_url,
    eligible.recruiter_id,
    eligible.salary_min,
    eligible.salary_max,
    eligible.salary_currency,
    eligible.posted_at,
    eligible.job_created_at,
    eligible.match_score,
    eligible.match_explanation,
    eligible.adapter_order,
    eligible.source_result_order,
    eligible.scraped_at,
    count(*) OVER () AS total_count
  FROM eligible
  ORDER BY eligible.adapter_order ASC,
           COALESCE(eligible.published_at, eligible.posted_at) DESC NULLS LAST,
           eligible.scraped_at DESC,
           eligible.source_result_order ASC
  LIMIT LEAST(GREATEST(p_limit, 1), 30)
  OFFSET GREATEST(p_offset, 0);
$$;

GRANT EXECUTE ON FUNCTION public.search_scrape_session_jobs(UUID, TEXT[], TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER) TO authenticated;
