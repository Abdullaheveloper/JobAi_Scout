-- A CV upload proposes one complete replacement of CV-managed profile fields.
-- Nothing reaches profiles until the owner approves the proposal.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS field_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.cv_profile_replacements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  resume_path TEXT NOT NULL,
  replacement_data JSONB NOT NULL,
  field_confidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  diff JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'superseded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS cv_profile_replacements_user_created_idx
  ON public.cv_profile_replacements (user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS one_pending_cv_profile_replacement_per_user
  ON public.cv_profile_replacements (user_id)
  WHERE status = 'pending';

ALTER TABLE public.cv_profile_replacements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own CV replacement proposals" ON public.cv_profile_replacements;
CREATE POLICY "Users view own CV replacement proposals"
  ON public.cv_profile_replacements FOR SELECT
  USING (auth.uid() = user_id);

GRANT SELECT ON public.cv_profile_replacements TO authenticated;
GRANT ALL ON public.cv_profile_replacements TO service_role;

CREATE OR REPLACE FUNCTION public.approve_cv_profile_replacement(p_replacement_id UUID)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  proposal public.cv_profile_replacements;
  updated_profile public.profiles;
  replacement JSONB;
  managed_fields CONSTANT TEXT[] := ARRAY[
    'full_name', 'phone', 'location', 'bio', 'skills', 'desired_roles',
    'experience_years', 'education', 'current_company', 'portfolio_url',
    'github_url', 'linkedin_url', 'certifications', 'languages', 'cv_summary'
  ];
  field_name TEXT;
  field_value JSONB;
  next_sources JSONB;
  next_metadata JSONB;
  approved_timestamp TIMESTAMPTZ := now();
BEGIN
  SELECT *
  INTO proposal
  FROM public.cv_profile_replacements
  WHERE id = p_replacement_id
    AND user_id = auth.uid()
    AND status = 'pending'
  FOR UPDATE;

  IF proposal.id IS NULL THEN
    RAISE EXCEPTION 'Pending CV replacement was not found';
  END IF;

  replacement := proposal.replacement_data;

  SELECT COALESCE(data_sources, '{}'::jsonb), COALESCE(field_metadata, '{}'::jsonb)
  INTO next_sources, next_metadata
  FROM public.profiles
  WHERE id = proposal.profile_id
    AND user_id = auth.uid()
  FOR UPDATE;

  FOREACH field_name IN ARRAY managed_fields LOOP
    field_value := replacement -> field_name;
    next_sources := next_sources - field_name;
    next_metadata := next_metadata - field_name;
    IF field_value IS NOT NULL
       AND field_value <> 'null'::jsonb
       AND field_value <> '[]'::jsonb
       AND field_value <> '""'::jsonb
       AND NOT (field_name = 'experience_years' AND field_value = '0'::jsonb) THEN
      next_sources := jsonb_set(next_sources, ARRAY[field_name], '"cv_upload"'::jsonb, true);
      next_metadata := jsonb_set(
        next_metadata,
        ARRAY[field_name],
        jsonb_build_object('source', 'cv_upload', 'lastUpdated', approved_timestamp),
        true
      );
    END IF;
  END LOOP;
  next_sources := jsonb_set(next_sources, ARRAY['resume_url'], '"cv_upload"'::jsonb, true);
  next_metadata := jsonb_set(
    next_metadata,
    ARRAY['resume_url'],
    jsonb_build_object('source', 'cv_upload', 'lastUpdated', approved_timestamp),
    true
  );

  UPDATE public.profiles
  SET
    resume_url = proposal.resume_path,
    full_name = NULLIF(trim(replacement ->> 'full_name'), ''),
    phone = NULLIF(trim(replacement ->> 'phone'), ''),
    location = NULLIF(trim(replacement ->> 'location'), ''),
    bio = NULLIF(trim(replacement ->> 'bio'), ''),
    skills = COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(replacement -> 'skills', '[]'::jsonb))), ARRAY[]::TEXT[]),
    desired_roles = COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(replacement -> 'desired_roles', '[]'::jsonb))), ARRAY[]::TEXT[]),
    experience_years = COALESCE((replacement ->> 'experience_years')::NUMERIC, 0),
    education = NULLIF(trim(replacement ->> 'education'), ''),
    current_company = NULLIF(trim(replacement ->> 'current_company'), ''),
    portfolio_url = NULLIF(trim(replacement ->> 'portfolio_url'), ''),
    github_url = NULLIF(trim(replacement ->> 'github_url'), ''),
    linkedin_url = NULLIF(trim(replacement ->> 'linkedin_url'), ''),
    certifications = COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(replacement -> 'certifications', '[]'::jsonb))), ARRAY[]::TEXT[]),
    languages = COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(replacement -> 'languages', '[]'::jsonb))), ARRAY[]::TEXT[]),
    cv_summary = NULLIF(trim(replacement ->> 'cv_summary'), ''),
    data_sources = next_sources,
    field_metadata = next_metadata,
    updated_at = approved_timestamp
  WHERE id = proposal.profile_id
    AND user_id = auth.uid()
  RETURNING * INTO updated_profile;

  IF updated_profile.id IS NULL THEN
    RAISE EXCEPTION 'Profile was not found';
  END IF;

  UPDATE public.cv_profile_replacements
  SET status = 'approved', approved_at = approved_timestamp
  WHERE id = proposal.id;

  RETURN updated_profile;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_cv_profile_replacement(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_cv_profile_replacement(UUID) TO authenticated;
