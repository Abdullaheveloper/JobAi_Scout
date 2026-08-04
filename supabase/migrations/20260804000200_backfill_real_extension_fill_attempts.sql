-- Preserve genuine historical Form Fill attempts that were metered before the
-- extension telemetry insert path was working. Field details were never sent,
-- so they intentionally remain empty instead of being fabricated.
INSERT INTO public.extension_usage(user_id,email,fields,field_count,page_url,created_at)
SELECT usage.user_id,profile.email,'{}'::TEXT[],0,NULL,usage.created_at
FROM public.feature_usage_log usage
LEFT JOIN public.profiles profile ON profile.user_id=usage.user_id
WHERE usage.feature='form_fill'
  AND NOT EXISTS (
    SELECT 1 FROM public.extension_usage event
    WHERE event.user_id=usage.user_id
      AND event.created_at BETWEEN usage.created_at-interval '5 seconds' AND usage.created_at+interval '5 seconds'
  );
