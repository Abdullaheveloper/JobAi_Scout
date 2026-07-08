-- Migration: Add kb metadata and voice cache
-- Adds metadata column to public.kb_chunks table and creates the voice_cache table

-- 1. Add metadata column to kb_chunks
ALTER TABLE public.kb_chunks ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- 2. Create voice_cache table
CREATE TABLE IF NOT EXISTS public.voice_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query text NOT NULL,
  answer text NOT NULL,
  sources jsonb NOT NULL,
  confidence float NOT NULL,
  language text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  UNIQUE(user_id, query)
);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_cache TO authenticated;
GRANT ALL ON public.voice_cache TO service_role;

-- Enable RLS
ALTER TABLE public.voice_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Users manage own voice cache" ON public.voice_cache
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Create index on user_id and query for faster lookups
CREATE INDEX IF NOT EXISTS voice_cache_user_query_idx ON public.voice_cache (user_id, query);
