-- Platform Analytics aggregates for admin dashboard (SECURITY DEFINER, admin-only).
-- Bypasses RLS for saved_jobs / voice tables where admins lack SELECT policies.

CREATE OR REPLACE FUNCTION public.get_platform_analytics(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  days int;
  series_days int;
  since_ts timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- NULL or <= 0 means lifetime totals; series still capped for chart readability
  IF p_days IS NULL OR p_days <= 0 THEN
    days := 0;
    series_days := 90;
  ELSE
    days := LEAST(GREATEST(p_days, 1), 365);
    series_days := days;
  END IF;

  since_ts := now() - (series_days || ' days')::interval;

  SELECT jsonb_build_object(
    'range_days', days,
    'series_days', series_days,
    'totals', jsonb_build_object(
      'users', (SELECT COUNT(*)::int FROM profiles),
      'jobs', (SELECT COUNT(*)::int FROM jobs),
      'active_jobs', (SELECT COUNT(*)::int FROM jobs WHERE COALESCE(is_active, true)),
      'posted_jobs', (SELECT COUNT(*)::int FROM jobs WHERE recruiter_id IS NOT NULL),
      'collected_jobs', (
        SELECT COUNT(*)::int FROM jobs
        WHERE source IS NOT NULL OR collected_at IS NOT NULL
      ),
      'applications', (SELECT COUNT(*)::int FROM job_applications),
      'external_applications', (SELECT COUNT(*)::int FROM applied_jobs),
      'saved_jobs', (SELECT COUNT(*)::int FROM saved_jobs),
      'cvs_uploaded', (
        SELECT COUNT(*)::int FROM profiles
        WHERE resume_url IS NOT NULL AND btrim(resume_url) <> ''
      ),
      'extension_fills', (SELECT COUNT(*)::int FROM extension_usage),
      'extension_fields', (SELECT COALESCE(SUM(field_count), 0)::int FROM extension_usage),
      'voice_conversations', (SELECT COUNT(*)::int FROM voice_conversations),
      'voice_messages', (SELECT COUNT(*)::int FROM voice_messages)
    ),
    'period', jsonb_build_object(
      'new_users', (
        SELECT COUNT(*)::int FROM profiles
        WHERE days = 0 OR created_at >= (now() - (days || ' days')::interval)
      ),
      'new_jobs', (
        SELECT COUNT(*)::int FROM jobs
        WHERE days = 0 OR created_at >= (now() - (days || ' days')::interval)
      ),
      'new_applications', (
        SELECT COUNT(*)::int FROM job_applications
        WHERE days = 0 OR applied_at >= (now() - (days || ' days')::interval)
      ),
      'new_extension_fills', (
        SELECT COUNT(*)::int FROM extension_usage
        WHERE days = 0 OR created_at >= (now() - (days || ' days')::interval)
      ),
      'new_voice_conversations', (
        SELECT COUNT(*)::int FROM voice_conversations
        WHERE days = 0 OR created_at >= (now() - (days || ' days')::interval)
      )
    ),
    'users_by_role', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object('name', role::text, 'value', cnt) ORDER BY cnt DESC
      ), '[]'::jsonb)
      FROM (
        SELECT role, COUNT(*)::int AS cnt
        FROM user_roles
        GROUP BY role
      ) r
    ),
    'signups_by_day', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object('day', day, 'count', cnt) ORDER BY day
      ), '[]'::jsonb)
      FROM (
        SELECT (created_at AT TIME ZONE 'UTC')::date AS day, COUNT(*)::int AS cnt
        FROM profiles
        WHERE created_at >= since_ts
        GROUP BY 1
      ) t
    ),
    'applications_by_day', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object('day', day, 'count', cnt) ORDER BY day
      ), '[]'::jsonb)
      FROM (
        SELECT (applied_at AT TIME ZONE 'UTC')::date AS day, COUNT(*)::int AS cnt
        FROM job_applications
        WHERE applied_at >= since_ts
        GROUP BY 1
      ) t
    ),
    'jobs_by_day', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object('day', day, 'count', cnt) ORDER BY day
      ), '[]'::jsonb)
      FROM (
        SELECT (created_at AT TIME ZONE 'UTC')::date AS day, COUNT(*)::int AS cnt
        FROM jobs
        WHERE created_at >= since_ts
        GROUP BY 1
      ) t
    ),
    'extension_by_day', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object('day', day, 'count', cnt) ORDER BY day
      ), '[]'::jsonb)
      FROM (
        SELECT (created_at AT TIME ZONE 'UTC')::date AS day, COUNT(*)::int AS cnt
        FROM extension_usage
        WHERE created_at >= since_ts
        GROUP BY 1
      ) t
    ),
    'application_status', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object('name', name, 'value', cnt) ORDER BY cnt DESC
      ), '[]'::jsonb)
      FROM (
        SELECT COALESCE(NULLIF(btrim(status), ''), 'applied') AS name, COUNT(*)::int AS cnt
        FROM job_applications
        GROUP BY 1
      ) s
    ),
    'jobs_by_source', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object('name', name, 'value', cnt) ORDER BY cnt DESC
      ), '[]'::jsonb)
      FROM (
        SELECT
          CASE
            WHEN recruiter_id IS NOT NULL THEN 'Recruiter posted'
            WHEN COALESCE(NULLIF(btrim(source_portal), ''), NULLIF(btrim(source), '')) IS NOT NULL
              THEN COALESCE(NULLIF(btrim(source_portal), ''), NULLIF(btrim(source), ''))
            ELSE 'Other / unknown'
          END AS name,
          COUNT(*)::int AS cnt
        FROM jobs
        GROUP BY 1
        ORDER BY cnt DESC
        LIMIT 8
      ) s
    ),
    'top_locations', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object('name', name, 'value', cnt) ORDER BY cnt DESC
      ), '[]'::jsonb)
      FROM (
        SELECT
          COALESCE(NULLIF(btrim(split_part(location, ',', 1)), ''), 'Unknown') AS name,
          COUNT(*)::int AS cnt
        FROM jobs
        WHERE location IS NOT NULL AND btrim(location) <> ''
        GROUP BY 1
        ORDER BY cnt DESC
        LIMIT 8
      ) l
    )
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_platform_analytics(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_platform_analytics(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_platform_analytics(integer) TO authenticated;

COMMENT ON FUNCTION public.get_platform_analytics(integer) IS
  'Admin-only platform KPI and time-series aggregates for /admin/analytics';
