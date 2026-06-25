-- Job Discovery System Migration
-- Adds job_preferences, recommended_jobs, scan_history tables
-- Extends saved_jobs and jobs tables

-- ============================================================
-- 1. job_preferences — stores user's job search preferences
-- ============================================================
CREATE TABLE IF NOT EXISTS public.job_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  keywords TEXT[] DEFAULT '{}',
  skills TEXT[] DEFAULT '{}',
  desired_role TEXT,
  preferred_locations TEXT[] DEFAULT '{}',
  salary_range TEXT,
  job_type TEXT,
  remote_preference TEXT DEFAULT 'any',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.job_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences" ON public.job_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own preferences" ON public.job_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own preferences" ON public.job_preferences FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
-- 2. recommended_jobs — per-user jobs from extension scanning
-- ============================================================
CREATE TABLE IF NOT EXISTS public.recommended_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  company_logo TEXT,
  location TEXT,
  description TEXT,
  salary TEXT,
  employment_type TEXT,
  experience_required TEXT,
  skills_required TEXT[] DEFAULT '{}',
  source_portal TEXT NOT NULL DEFAULT 'unknown',
  source_url TEXT,
  match_score INTEGER DEFAULT 0,
  match_explanation JSONB DEFAULT '{}',
  posted_date TEXT,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.recommended_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recommended jobs" ON public.recommended_jobs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own recommended jobs" ON public.recommended_jobs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own recommended jobs" ON public.recommended_jobs FOR DELETE USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_recommended_jobs_user_score ON public.recommended_jobs(user_id, match_score DESC);
CREATE INDEX IF NOT EXISTS idx_recommended_jobs_user_synced ON public.recommended_jobs(user_id, synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_recommended_jobs_source_url ON public.recommended_jobs(source_url);

-- ============================================================
-- 3. scan_history — tracks extension scan sessions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.scan_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  portal TEXT NOT NULL,
  jobs_found INTEGER DEFAULT 0,
  jobs_matched INTEGER DEFAULT 0,
  jobs_synced INTEGER DEFAULT 0,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.scan_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scan history" ON public.scan_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own scan history" ON public.scan_history FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 4. Extend saved_jobs to also reference recommended_jobs
-- ============================================================
ALTER TABLE public.saved_jobs ADD COLUMN IF NOT EXISTS recommended_job_id UUID REFERENCES public.recommended_jobs(id) ON DELETE CASCADE;

-- Make job_id nullable so recommended-only saves don't need a real job_id
ALTER TABLE public.saved_jobs ALTER COLUMN job_id DROP NOT NULL;

-- Drop the strict FK on job_id and recreate it as a soft reference
ALTER TABLE public.saved_jobs DROP CONSTRAINT IF EXISTS saved_jobs_job_id_fkey;
ALTER TABLE public.saved_jobs ADD CONSTRAINT saved_jobs_job_id_fkey
  FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE SET NULL;

-- ============================================================
-- 5. Add company_logo column to jobs table
-- ============================================================
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS company_logo TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS source_portal TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS match_score INTEGER DEFAULT 0;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS match_explanation JSONB DEFAULT '{}';
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS employment_type TEXT;

-- ============================================================
-- 6. Trigger to auto-update job_preferences updated_at
-- ============================================================
CREATE TRIGGER update_job_preferences_updated_at
  BEFORE UPDATE ON public.job_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 7. Function: enforce max 20 recommended jobs per user
--    When new job arrives, remove oldest unsaved job
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_recommended_jobs_limit()
RETURNS TRIGGER AS $$
DECLARE
  max_jobs CONSTANT INTEGER := 20;
  current_count INTEGER;
  saved_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO current_count
  FROM public.recommended_jobs
  WHERE user_id = NEW.user_id;

  IF current_count >= max_jobs THEN
    -- Count how many are saved (protected)
    SELECT COUNT(*) INTO saved_count
    FROM public.recommended_jobs rj
    JOIN public.saved_jobs sj ON sj.recommended_job_id = rj.id
    WHERE rj.user_id = NEW.user_id;

    -- Only delete unsaved jobs if we've hit the limit
    IF saved_count < max_jobs THEN
      DELETE FROM public.recommended_jobs
      WHERE id = (
        SELECT rj.id FROM public.recommended_jobs rj
        WHERE rj.user_id = NEW.user_id
          AND NOT EXISTS (
            SELECT 1 FROM public.saved_jobs sj WHERE sj.recommended_job_id = rj.id
          )
        ORDER BY rj.synced_at ASC
        LIMIT 1
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_enforce_recommended_limit
  BEFORE INSERT ON public.recommended_jobs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_recommended_jobs_limit();

-- ============================================================
-- 8. Function: check for duplicate jobs
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_duplicate_recommended_job(
  p_user_id UUID,
  p_source_url TEXT,
  p_company TEXT,
  p_title TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.recommended_jobs
    WHERE user_id = p_user_id
      AND (
        (p_source_url IS NOT NULL AND source_url = p_source_url)
        OR (LOWER(company) = LOWER(p_company) AND LOWER(title) = LOWER(p_title))
      )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
