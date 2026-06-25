-- Add new profile fields for enhanced CV parsing and profile builder
-- Backward compatible: all new columns are nullable with defaults

-- Portfolio URL (extension already expects this)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS portfolio_url TEXT;

-- Current company (extension already expects this)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_company TEXT;

-- Expected salary (extension already expects this)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS expected_salary TEXT;

-- Education details extracted from CV
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS education TEXT;

-- Certifications extracted from CV
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS certifications TEXT[] DEFAULT '{}';

-- Languages spoken
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS languages TEXT[] DEFAULT '{}';

-- Track which source populated each field: "ai", "user", "system", "extension"
-- Structure: { "full_name": "ai", "email": "system", "skills": "user", ... }
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS data_sources JSONB DEFAULT '{}';

-- Cached profile completion percentage (0-100)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_completion INTEGER DEFAULT 0;

-- Function to calculate and update profile completion
CREATE OR REPLACE FUNCTION public.calculate_profile_completion(p profiles)
RETURNS INTEGER
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  total INTEGER := 0;
  filled INTEGER := 0;
BEGIN
  -- Define all trackable fields and check each
  -- 1. full_name
  total := total + 1;
  IF p.full_name IS NOT NULL AND trim(p.full_name) != '' THEN filled := filled + 1; END IF;
  -- 2. email
  total := total + 1;
  IF p.email IS NOT NULL AND trim(p.email) != '' THEN filled := filled + 1; END IF;
  -- 3. phone
  total := total + 1;
  IF p.phone IS NOT NULL AND trim(p.phone) != '' THEN filled := filled + 1; END IF;
  -- 4. location
  total := total + 1;
  IF p.location IS NOT NULL AND trim(p.location) != '' THEN filled := filled + 1; END IF;
  -- 5. bio
  total := total + 1;
  IF p.bio IS NOT NULL AND trim(p.bio) != '' THEN filled := filled + 1; END IF;
  -- 6. skills
  total := total + 1;
  IF p.skills IS NOT NULL AND array_length(p.skills, 1) > 0 THEN filled := filled + 1; END IF;
  -- 7. desired_roles
  total := total + 1;
  IF p.desired_roles IS NOT NULL AND array_length(p.desired_roles, 1) > 0 THEN filled := filled + 1; END IF;
  -- 8. experience_years
  total := total + 1;
  IF p.experience_years IS NOT NULL AND p.experience_years > 0 THEN filled := filled + 1; END IF;
  -- 9. resume_url
  total := total + 1;
  IF p.resume_url IS NOT NULL AND trim(p.resume_url) != '' THEN filled := filled + 1; END IF;
  -- 10. linkedin_url
  total := total + 1;
  IF p.linkedin_url IS NOT NULL AND trim(p.linkedin_url) != '' THEN filled := filled + 1; END IF;
  -- 11. github_url
  total := total + 1;
  IF p.github_url IS NOT NULL AND trim(p.github_url) != '' THEN filled := filled + 1; END IF;
  -- 12. portfolio_url
  total := total + 1;
  IF p.portfolio_url IS NOT NULL AND trim(p.portfolio_url) != '' THEN filled := filled + 1; END IF;
  -- 13. current_company
  total := total + 1;
  IF p.current_company IS NOT NULL AND trim(p.current_company) != '' THEN filled := filled + 1; END IF;
  -- 14. education
  total := total + 1;
  IF p.education IS NOT NULL AND trim(p.education) != '' THEN filled := filled + 1; END IF;

  RETURN CASE WHEN total = 0 THEN 0 ELSE round((filled::numeric / total::numeric) * 100)::integer END;
END;
$$;

-- Function to update data_sources for specific fields
CREATE OR REPLACE FUNCTION public.update_profile_data_sources(
  p_user_id UUID,
  p_field_names TEXT[],
  p_source TEXT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sources JSONB;
  v_field TEXT;
BEGIN
  SELECT data_sources INTO v_sources FROM public.profiles WHERE user_id = p_user_id;
  IF v_sources IS NULL THEN v_sources := '{}'::jsonb; END IF;
  
  FOREACH v_field IN ARRAY p_field_names LOOP
    v_sources := jsonb_set(v_sources, ARRAY[v_field], to_jsonb(p_source));
  END LOOP;
  
  UPDATE public.profiles SET data_sources = v_sources WHERE user_id = p_user_id;
END;
$$;

-- Trigger function to auto-update profile_completion on any profile change
CREATE OR REPLACE FUNCTION public.auto_update_profile_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.profile_completion := public.calculate_profile_completion(NEW);
  RETURN NEW;
END;
$$;

-- Add trigger (drop first in case it already exists)
DROP TRIGGER IF EXISTS auto_update_completion ON public.profiles;
CREATE TRIGGER auto_update_completion
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.auto_update_profile_completion();

-- Update existing profiles to have correct completion scores
UPDATE public.profiles SET profile_completion = public.calculate_profile_completion(profiles);
