ALTER TABLE public.job_sources
  ADD COLUMN IF NOT EXISTS last_collected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_result_count INTEGER,
  ADD COLUMN IF NOT EXISTS last_error TEXT;
