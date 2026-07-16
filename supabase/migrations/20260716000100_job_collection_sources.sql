-- Normalized external job collection metadata. Existing recruiter jobs remain valid.
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS work_mode TEXT,
  ADD COLUMN IF NOT EXISTS salary_currency TEXT,
  ADD COLUMN IF NOT EXISTS source_job_id TEXT,
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS duplicate_key TEXT,
  ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS collected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

UPDATE public.jobs
SET source_url = COALESCE(source_url, job_url),
    posted_at = COALESCE(posted_at, date_posted),
    collected_at = COALESCE(collected_at, created_at),
    last_seen_at = COALESCE(last_seen_at, updated_at)
WHERE source_url IS NULL OR posted_at IS NULL OR collected_at IS NULL OR last_seen_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS jobs_source_source_job_id_unique
  ON public.jobs (source, source_job_id)
  WHERE source_job_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS jobs_source_url_unique
  ON public.jobs (source_url)
  WHERE source_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS jobs_duplicate_key_idx ON public.jobs (duplicate_key);
CREATE INDEX IF NOT EXISTS jobs_active_search_idx ON public.jobs (status, is_active, posted_at DESC);

CREATE TABLE IF NOT EXISTS public.job_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL CHECK (source_type IN ('linkedin_apify', 'rss', 'company_career')),
  name TEXT NOT NULL,
  url TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.job_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage job sources" ON public.job_sources FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_job_sources_updated_at
  BEFORE UPDATE ON public.job_sources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.job_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  keyword TEXT,
  location TEXT,
  searched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  results_count INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE public.job_searches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own job searches" ON public.job_searches FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users add own job searches" ON public.job_searches FOR INSERT WITH CHECK (auth.uid() = user_id);
