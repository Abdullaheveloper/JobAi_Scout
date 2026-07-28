-- Feature usage limits: per-invocation log + per-user/global limits.
-- Resolution: user override → global default → unlimited (warned in app code).

CREATE TYPE public.usage_feature AS ENUM (
  'job_scraping',
  'form_fill',
  'voice_assistant',
  'automation'
);

CREATE TYPE public.usage_period AS ENUM (
  'day',
  'month',
  'year'
);

-- One row per allowed invocation (rolling windows query this table).
CREATE TABLE public.feature_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature public.usage_feature NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX feature_usage_log_user_feature_created_idx
  ON public.feature_usage_log (user_id, feature, created_at DESC);

CREATE INDEX feature_usage_log_created_at_idx
  ON public.feature_usage_log (created_at DESC);

-- user_id NULL = platform-wide default for that feature.
CREATE TABLE public.feature_usage_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  feature public.usage_feature NOT NULL,
  max_count INTEGER NOT NULL CHECK (max_count >= 0),
  period public.usage_period NOT NULL DEFAULT 'day',
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One override per (user, feature); one global default per feature.
CREATE UNIQUE INDEX feature_usage_limits_user_feature_uidx
  ON public.feature_usage_limits (user_id, feature)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX feature_usage_limits_global_feature_uidx
  ON public.feature_usage_limits (feature)
  WHERE user_id IS NULL;

CREATE INDEX feature_usage_limits_updated_at_idx
  ON public.feature_usage_limits (updated_at DESC);

ALTER TABLE public.feature_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_usage_limits ENABLE ROW LEVEL SECURITY;

-- Admins can read everything; users can read their own usage/limits.
DROP POLICY IF EXISTS "Admins read usage log" ON public.feature_usage_log;
CREATE POLICY "Admins read usage log"
  ON public.feature_usage_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users read own usage log" ON public.feature_usage_log;
CREATE POLICY "Users read own usage log"
  ON public.feature_usage_log FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins read usage limits" ON public.feature_usage_limits;
CREATE POLICY "Admins read usage limits"
  ON public.feature_usage_limits FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users read own or global limits" ON public.feature_usage_limits;
CREATE POLICY "Users read own or global limits"
  ON public.feature_usage_limits FOR SELECT TO authenticated
  USING (user_id IS NULL OR auth.uid() = user_id);

-- Writes only via service role (edge functions).
REVOKE ALL ON TABLE public.feature_usage_log FROM PUBLIC;
REVOKE ALL ON TABLE public.feature_usage_limits FROM PUBLIC;
GRANT SELECT ON TABLE public.feature_usage_log TO authenticated;
GRANT SELECT ON TABLE public.feature_usage_limits TO authenticated;
GRANT ALL ON TABLE public.feature_usage_log TO service_role;
GRANT ALL ON TABLE public.feature_usage_limits TO service_role;

-- Seed sensible global defaults (unlimited is never silent — these exist so
-- resolution prefers global over unlimited). Admins can edit immediately.
INSERT INTO public.feature_usage_limits (user_id, feature, max_count, period)
VALUES
  (NULL, 'job_scraping', 20, 'day'),
  (NULL, 'form_fill', 50, 'day'),
  (NULL, 'voice_assistant', 100, 'day'),
  (NULL, 'automation', 10, 'day');
