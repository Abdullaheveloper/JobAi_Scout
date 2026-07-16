-- Voice-first history: transcripts remain private application data; the UI uses audio only.
ALTER TABLE public.voice_messages
  ADD COLUMN IF NOT EXISTS audio_path text,
  ADD COLUMN IF NOT EXISTS duration_ms integer;

CREATE TABLE IF NOT EXISTS public.user_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  memory text NOT NULL,
  importance smallint NOT NULL DEFAULT 1 CHECK (importance BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_memory_user_created_idx
  ON public.user_memory (user_id, created_at DESC);

ALTER TABLE public.user_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own voice memories" ON public.user_memory
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

INSERT INTO storage.buckets (id, name, public)
VALUES ('voice-history', 'voice-history', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users read their own voice history" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'voice-history' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users upload their own voice history" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'voice-history' AND (storage.foldername(name))[1] = auth.uid()::text);
