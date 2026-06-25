-- ============================================================
-- Fix: Add missing columns to profiles table
-- Run this in Supabase SQL Editor > Run
-- Safe to run multiple times (uses IF NOT EXISTS)
-- ============================================================

-- Portfolio / career URL
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS portfolio_url TEXT;

-- Current employer
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_company TEXT;

-- Expected salary range (stored as text for flexibility, e.g. "$60k-$80k")
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS expected_salary TEXT;

-- Education summary (free text)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS education TEXT;

-- Certifications (array of strings)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS certifications TEXT[] DEFAULT '{}';

-- Languages spoken (array of strings)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS languages TEXT[] DEFAULT '{}';

-- Data sources map: tracks whether each field was set by "ai", "user", "system", or "extension"
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS data_sources JSONB DEFAULT '{}';

-- Cached profile completion percentage (0-100)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_completion INTEGER DEFAULT 0;

-- Ensure cv_summary column exists (used by CV upload)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cv_summary TEXT DEFAULT NULL;

-- Ensure location column exists
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location TEXT DEFAULT NULL;

-- ============================================================
-- RPC: update_profile_data_sources
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_profile_data_sources(
  p_user_id  UUID,
  p_field_names TEXT[],
  p_source TEXT
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_sources JSONB;
  field TEXT;
BEGIN
  SELECT COALESCE(data_sources, '{}') INTO current_sources
  FROM profiles WHERE user_id = p_user_id;

  FOREACH field IN ARRAY p_field_names LOOP
    current_sources := jsonb_set(current_sources, ARRAY[field], to_jsonb(p_source));
  END LOOP;

  UPDATE profiles SET data_sources = current_sources WHERE user_id = p_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_profile_data_sources(UUID, TEXT[], TEXT) FROM anon;
GRANT  EXECUTE ON FUNCTION public.update_profile_data_sources(UUID, TEXT[], TEXT) TO authenticated;
