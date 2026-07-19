ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS commute_to_office TEXT;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_commute_to_office_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_commute_to_office_check
  CHECK (commute_to_office IS NULL OR commute_to_office IN ('yes', 'no', 'depends'));

CREATE OR REPLACE FUNCTION public.update_profile_data_sources(
  p_user_id UUID,
  p_field_names TEXT[],
  p_source TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_sources JSONB;
  field_name TEXT;
  allowed_fields CONSTANT TEXT[] := ARRAY[
    'full_name', 'email', 'phone', 'location', 'bio', 'linkedin_url',
    'github_url', 'portfolio_url', 'current_company', 'expected_salary',
    'skills', 'desired_roles', 'experience_years', 'education',
    'certifications', 'languages', 'cv_summary', 'resume_url',
    'work_authorization', 'willing_to_relocate', 'commute_to_office',
    'availability', 'work_type', 'career_profile', 'autofill_preferences'
  ];
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'You may only update provenance for your own profile';
  END IF;

  IF p_source NOT IN ('ai', 'user', 'extension', 'system') THEN
    RAISE EXCEPTION 'Invalid profile data source';
  END IF;

  SELECT COALESCE(data_sources, '{}'::jsonb)
  INTO current_sources
  FROM public.profiles
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF current_sources IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  FOREACH field_name IN ARRAY COALESCE(p_field_names, ARRAY[]::TEXT[]) LOOP
    IF NOT field_name = ANY(allowed_fields) THEN
      RAISE EXCEPTION 'Invalid profile field: %', field_name;
    END IF;
    current_sources := jsonb_set(current_sources, ARRAY[field_name], to_jsonb(p_source), true);
  END LOOP;

  UPDATE public.profiles
  SET data_sources = current_sources,
      updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_profile_data_sources(UUID, TEXT[], TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_profile_data_sources(UUID, TEXT[], TEXT) TO authenticated, service_role;
