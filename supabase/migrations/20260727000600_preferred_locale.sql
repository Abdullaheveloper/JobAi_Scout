-- Persist UI language preference for logged-in users.
-- Guests continue to use localStorage (jobai_preferred_locale).
-- Resolution order: profiles.preferred_locale → localStorage → 'en'.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_locale TEXT NOT NULL DEFAULT 'en';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_preferred_locale_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_preferred_locale_check
      CHECK (preferred_locale ~ '^[a-z]{2}(-[A-Za-z0-9]+)?$');
  END IF;
END $$;

COMMENT ON COLUMN public.profiles.preferred_locale IS
  'Preferred UI locale code (e.g. en). Phase 1 supports English only.';
