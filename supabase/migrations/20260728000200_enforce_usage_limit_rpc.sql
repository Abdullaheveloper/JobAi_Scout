-- Atomic check + optional record for feature usage limits.
-- Serializes concurrent enforce/record for the same (user, feature) via advisory lock.

CREATE OR REPLACE FUNCTION public.enforce_and_record_feature_usage(
  p_user_id uuid,
  p_feature public.usage_feature,
  p_record boolean DEFAULT true,
  p_now timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_count integer;
  v_period public.usage_period;
  v_source text;
  v_used integer;
  v_window_start timestamptz;
  v_period_interval interval;
  v_oldest_blocking timestamptz;
  v_resets_at timestamptz;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id required';
  END IF;

  -- One concurrent check/record path per user+feature within this transaction.
  PERFORM pg_advisory_xact_lock(
    hashtext(p_user_id::text || ':' || p_feature::text)
  );

  SELECT max_count, period
  INTO v_max_count, v_period
  FROM public.feature_usage_limits
  WHERE user_id = p_user_id AND feature = p_feature;

  IF FOUND THEN
    v_source := 'user';
  ELSE
    SELECT max_count, period
    INTO v_max_count, v_period
    FROM public.feature_usage_limits
    WHERE user_id IS NULL AND feature = p_feature;

    IF FOUND THEN
      v_source := 'global';
    ELSE
      v_source := 'unlimited';
      IF p_record THEN
        INSERT INTO public.feature_usage_log (user_id, feature)
        VALUES (p_user_id, p_feature);
      END IF;
      RETURN jsonb_build_object(
        'allowed', true,
        'used', 0,
        'source', 'unlimited',
        'maxCount', NULL,
        'period', 'day',
        'resetsAt', NULL
      );
    END IF;
  END IF;

  v_period_interval := CASE v_period
    WHEN 'day' THEN interval '1 day'
    WHEN 'month' THEN interval '30 days'
    WHEN 'year' THEN interval '365 days'
  END;
  v_window_start := p_now - v_period_interval;

  SELECT COUNT(*)::integer
  INTO v_used
  FROM public.feature_usage_log
  WHERE user_id = p_user_id
    AND feature = p_feature
    AND created_at >= v_window_start;

  IF v_max_count <= 0 OR v_used >= v_max_count THEN
    IF v_max_count <= 0 THEN
      v_resets_at := NULL;
    ELSE
      SELECT created_at
      INTO v_oldest_blocking
      FROM public.feature_usage_log
      WHERE user_id = p_user_id
        AND feature = p_feature
        AND created_at >= v_window_start
      ORDER BY created_at ASC
      OFFSET GREATEST(v_used - v_max_count, 0)
      LIMIT 1;

      v_resets_at := v_oldest_blocking + v_period_interval;
    END IF;

    RETURN jsonb_build_object(
      'allowed', false,
      'used', v_used,
      'source', v_source,
      'maxCount', v_max_count,
      'period', v_period,
      'resetsAt', CASE
        WHEN v_resets_at IS NULL THEN NULL
        ELSE to_jsonb(v_resets_at)
      END
    );
  END IF;

  IF p_record THEN
    INSERT INTO public.feature_usage_log (user_id, feature)
    VALUES (p_user_id, p_feature);
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'used', v_used,
    'source', v_source,
    'maxCount', v_max_count,
    'period', v_period,
    'resetsAt', NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_and_record_feature_usage(uuid, public.usage_feature, boolean, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enforce_and_record_feature_usage(uuid, public.usage_feature, boolean, timestamptz) TO service_role;
