-- Persist UI color theme preference for logged-in users.
-- Guests continue to use localStorage (jobai_theme).
-- Resolution order: profiles.preferred_theme → localStorage → OS prefers-color-scheme → 'dark'.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_theme TEXT NOT NULL DEFAULT 'dark';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_preferred_theme_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_preferred_theme_check
      CHECK (preferred_theme IN ('light', 'dark'));
  END IF;
END $$;

COMMENT ON COLUMN public.profiles.preferred_theme IS
  'Preferred UI color theme: light or dark.';
