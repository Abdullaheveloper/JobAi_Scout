-- Allow fractional experience years (e.g. 0.3 from a 3-month internship).
-- approve_cv_profile_replacement already casts via ::NUMERIC; the column was INTEGER.
ALTER TABLE public.profiles
  ALTER COLUMN experience_years TYPE NUMERIC(4,1)
  USING ROUND(COALESCE(experience_years, 0)::numeric, 1);

ALTER TABLE public.profiles
  ALTER COLUMN experience_years SET DEFAULT 0;

COMMENT ON COLUMN public.profiles.experience_years IS
  'Total professional experience in years (0–40, one decimal). Breakdown note may live in field_metadata.experience_years.calcNote.';
