-- Keep profile readiness and dashboard match counts synchronized across clients.
UPDATE public.profiles
SET profile_completion = public.calculate_profile_completion(profiles);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'profiles'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'recommended_jobs'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.recommended_jobs;
    END IF;
  END IF;
END
$$;
