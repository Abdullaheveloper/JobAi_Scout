CREATE OR REPLACE FUNCTION public.get_platform_automation_analytics(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  days integer := CASE WHEN p_days IS NULL OR p_days <= 0 THEN 0 ELSE LEAST(GREATEST(p_days, 1), 365) END;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN jsonb_build_object(
    'active', (SELECT COUNT(*)::integer FROM public.job_scrape_schedules WHERE is_active),
    'total', (SELECT COUNT(*)::integer FROM public.job_scrape_schedules),
    'created_in_range', (
      SELECT COUNT(*)::integer
      FROM public.job_scrape_schedules
      WHERE days = 0 OR created_at >= now() - (days || ' days')::interval
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_platform_automation_analytics(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_platform_automation_analytics(integer) TO authenticated;

DROP POLICY IF EXISTS "Admins view all job scrape schedules" ON public.job_scrape_schedules;
CREATE POLICY "Admins view all job scrape schedules"
  ON public.job_scrape_schedules FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
    AND NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'job_scrape_schedules'
    )
  THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.job_scrape_schedules;
  END IF;
END
$$;
