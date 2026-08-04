-- Archive jobs after 20 days while preserving saved-job visibility and history.
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS jobs_active_retention_idx
  ON public.jobs (created_at DESC) WHERE is_archived = false;
CREATE INDEX IF NOT EXISTS jobs_archived_at_idx
  ON public.jobs (archived_at DESC) WHERE is_archived = true;

CREATE TABLE IF NOT EXISTS public.job_retention_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cutoff_at timestamptz NOT NULL,
  archived_count integer NOT NULL DEFAULT 0,
  ran_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.job_retention_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read job retention runs" ON public.job_retention_runs;
CREATE POLICY "Admins read job retention runs" ON public.job_retention_runs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
GRANT SELECT ON public.job_retention_runs TO authenticated;
GRANT ALL ON public.job_retention_runs TO service_role;

CREATE OR REPLACE FUNCTION public.archive_expired_jobs(p_now timestamptz DEFAULT now())
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l_cutoff timestamptz := p_now - interval '20 days'; l_count integer;
BEGIN
  UPDATE jobs SET is_archived=true,archived_at=p_now,updated_at=p_now
  WHERE is_archived=false AND created_at < l_cutoff;
  GET DIAGNOSTICS l_count = ROW_COUNT;
  INSERT INTO job_retention_runs(cutoff_at,archived_count,ran_at) VALUES(l_cutoff,l_count,p_now);
  RETURN l_count;
END $$;
REVOKE ALL ON FUNCTION public.archive_expired_jobs(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.archive_expired_jobs(timestamptz) TO service_role;

-- Existing records become archived immediately; no record is deleted.
SELECT public.archive_expired_jobs(now());

DROP POLICY IF EXISTS "Jobs are viewable by authenticated users" ON public.jobs;
CREATE POLICY "Active or personally saved jobs are viewable"
ON public.jobs FOR SELECT TO authenticated USING (
  (is_archived=false AND created_at >= now()-interval '20 days')
  OR EXISTS (SELECT 1 FROM public.saved_jobs saved WHERE saved.job_id=jobs.id AND saved.user_id=auth.uid())
  OR public.has_role(auth.uid(),'admin')
);

CREATE EXTENSION IF NOT EXISTS pg_cron;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='archive-expired-jobs-daily') THEN
    PERFORM cron.unschedule('archive-expired-jobs-daily');
  END IF;
END $$;
SELECT cron.schedule('archive-expired-jobs-daily','15 0 * * *',
  $cron$SELECT public.archive_expired_jobs(now());$cron$);

CREATE OR REPLACE FUNCTION public.search_jobs_unified(
  p_query TEXT DEFAULT NULL, p_title TEXT DEFAULT NULL, p_company TEXT DEFAULT NULL,
  p_location TEXT DEFAULT NULL, p_job_type TEXT DEFAULT NULL,
  p_experience_level TEXT DEFAULT NULL, p_salary_min INTEGER DEFAULT NULL,
  p_salary_max INTEGER DEFAULT NULL, p_work_mode TEXT DEFAULT NULL,
  p_source_type TEXT DEFAULT NULL, p_posted_days INTEGER DEFAULT NULL,
  p_min_match_score INTEGER DEFAULT NULL, p_limit INTEGER DEFAULT 30,
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
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH viewer AS (
    SELECT profile AS profile_row, LEAST(100,GREATEST(0,COALESCE(p_min_match_score,profile.min_match_threshold,40)))::INTEGER threshold
    FROM profiles profile WHERE profile.user_id=auth.uid() LIMIT 1
  ), candidates AS (
    SELECT posting.*,saved.session_id,
      COALESCE(saved.match_score,profile_job_match_score(posting,viewer.profile_row)) viewer_score,
      COALESCE(saved.match_explanation,jsonb_build_object('source','profile-calculation')) viewer_explanation,
      saved.adapter_order,saved.source_result_order,saved.scraped_at,viewer.threshold
    FROM jobs posting CROSS JOIN viewer LEFT JOIN LATERAL (
      SELECT result.session_id,result.match_score,result.match_explanation,result.adapter_order,result.source_result_order,result.scraped_at
      FROM job_scrape_results result WHERE result.job_id=posting.id AND result.user_id=auth.uid()
      ORDER BY result.scraped_at DESC LIMIT 1
    ) saved ON true
    WHERE posting.is_archived=false AND posting.created_at >= now()-interval '20 days'
      AND COALESCE(posting.is_active,true) AND COALESCE(posting.status,'active')='active'
      AND (posting.recruiter_id IS NOT NULL OR saved.session_id IS NOT NULL)
  ), eligible AS (
    SELECT * FROM candidates WHERE viewer_score >= threshold
      AND (NULLIF(trim(p_query),'') IS NULL OR title ILIKE '%'||trim(p_query)||'%' OR company ILIKE '%'||trim(p_query)||'%' OR COALESCE(location,'') ILIKE '%'||trim(p_query)||'%' OR COALESCE(array_to_string(skills,' '),'') ILIKE '%'||trim(p_query)||'%' OR COALESCE(description,'') ILIKE '%'||trim(p_query)||'%')
      AND (NULLIF(trim(p_title),'') IS NULL OR title ILIKE '%'||trim(p_title)||'%')
      AND (NULLIF(trim(p_company),'') IS NULL OR company ILIKE '%'||trim(p_company)||'%')
      AND (NULLIF(trim(p_location),'') IS NULL OR COALESCE(location,'') ILIKE '%'||trim(p_location)||'%')
      AND (p_job_type IS NULL OR lower(COALESCE(job_type,employment_type,''))=lower(p_job_type))
      AND (p_experience_level IS NULL OR lower(COALESCE(experience_level,''))=lower(p_experience_level))
      AND (p_salary_min IS NULL OR salary_max>=p_salary_min) AND (p_salary_max IS NULL OR salary_min<=p_salary_max)
      AND (p_work_mode IS NULL OR lower(COALESCE(work_mode,'')||' '||COALESCE(location,'')) LIKE '%'||lower(p_work_mode)||'%')
      AND (p_source_type IS NULL OR (p_source_type='recruiter' AND recruiter_id IS NOT NULL) OR (p_source_type='scraped' AND recruiter_id IS NULL AND session_id IS NOT NULL))
      AND (p_posted_days IS NULL OR COALESCE(posted_at,date_posted,created_at)>=now()-make_interval(days=>p_posted_days))
  )
  SELECT id,session_id,title,company,location,description,skills,job_type,employment_type,work_mode,source,COALESCE(source_url,job_url),recruiter_id,
    salary_min,salary_max,salary_currency,COALESCE(posted_at,date_posted),created_at,viewer_score,viewer_explanation,adapter_order,source_result_order,scraped_at,count(*) OVER()
  FROM eligible ORDER BY CASE WHEN NULLIF(trim(p_query),'') IS NOT NULL AND lower(title) LIKE lower(trim(p_query))||'%' THEN 0 ELSE 1 END,
    viewer_score DESC,COALESCE(posted_at,date_posted,created_at) DESC NULLS LAST
  LIMIT LEAST(GREATEST(p_limit,1),50) OFFSET GREATEST(p_offset,0);
$$;
