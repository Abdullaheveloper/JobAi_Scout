-- A structured, user-owned career passport. JSONB keeps the existing one-row
-- profile API compatible while allowing repeatable experience, education,
-- project, achievement and reference records.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS career_profile JSONB NOT NULL DEFAULT jsonb_build_object(
    'version', 1,
    'experiences', '[]'::jsonb,
    'education', '[]'::jsonb,
    'projects', '[]'::jsonb,
    'achievements', '[]'::jsonb,
    'references', '[]'::jsonb
  ),
  ADD COLUMN IF NOT EXISTS autofill_preferences JSONB NOT NULL DEFAULT jsonb_build_object(
    'version', 1,
    'textAutofillConfidence', 0.75,
    'checkboxConfidence', 0.41,
    'reviewBeforeSensitiveAnswers', true
  );

-- Existing profiles may have NULL values after a previous partial migration.
UPDATE public.profiles
SET career_profile = jsonb_build_object(
      'version', 1,
      'experiences', '[]'::jsonb,
      'education', '[]'::jsonb,
      'projects', '[]'::jsonb,
      'achievements', '[]'::jsonb,
      'references', '[]'::jsonb
    )
WHERE career_profile IS NULL;

UPDATE public.profiles
SET autofill_preferences = jsonb_build_object(
      'version', 1,
      'textAutofillConfidence', 0.75,
      'checkboxConfidence', 0.41,
      'reviewBeforeSensitiveAnswers', true
    )
WHERE autofill_preferences IS NULL;

-- Repair the source-provenance helper. An authenticated caller can only tag
-- their own profile; trusted server-side clients have no auth.uid() and retain
-- the ability to record AI extraction provenance.
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
    'career_profile', 'autofill_preferences'
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
