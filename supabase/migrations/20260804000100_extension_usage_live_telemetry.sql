ALTER TABLE public.extension_usage
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS extension_usage_user_created_idx
  ON public.extension_usage(user_id,created_at DESC);

-- Admin Dashboard subscribes to inserts and completion updates. Add the table
-- to Realtime where it is not already present; polling remains as fallback.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='extension_usage'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.extension_usage;
  END IF;
END $$;
