-- Recruiter-only job discovery uses database filters and never invokes scraping.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE INDEX IF NOT EXISTS jobs_recruiter_active_posted_idx
  ON public.jobs (date_posted DESC)
  WHERE recruiter_id IS NOT NULL AND is_active = true;

CREATE INDEX IF NOT EXISTS jobs_recruiter_title_trgm_idx
  ON public.jobs USING gin (title extensions.gin_trgm_ops)
  WHERE recruiter_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS jobs_recruiter_company_trgm_idx
  ON public.jobs USING gin (company extensions.gin_trgm_ops)
  WHERE recruiter_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS jobs_recruiter_location_trgm_idx
  ON public.jobs USING gin (location extensions.gin_trgm_ops)
  WHERE recruiter_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS jobs_recruiter_filter_idx
  ON public.jobs (job_type, experience_level, salary_min, salary_max)
  WHERE recruiter_id IS NOT NULL AND is_active = true;
