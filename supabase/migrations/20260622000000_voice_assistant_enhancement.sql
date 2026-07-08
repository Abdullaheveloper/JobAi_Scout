-- Voice Assistant Enhancement Tables
-- Adds: voice_settings, voice_analytics, voice_search_logs
-- Does NOT modify any existing tables

-- ============================================================================
-- 1. VOICE SETTINGS (global admin config + per-user preferences)
-- ============================================================================
CREATE TABLE public.voice_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,  -- NULL = global admin config
  -- Admin global settings (only set when user_id IS NULL)
  assistant_enabled boolean NOT NULL DEFAULT true,
  silence_timeout integer NOT NULL DEFAULT 2,           -- 1-5 seconds
  confidence_threshold float NOT NULL DEFAULT 0.70,     -- 0.0-1.0
  supported_languages text[] NOT NULL DEFAULT ARRAY['en','ur','ar','hi','fr','de'],
  default_personality text NOT NULL DEFAULT 'professional',
  default_speed float NOT NULL DEFAULT 1.0,
  -- Per-user preferences (only set when user_id IS NOT NULL)
  preferred_language text,
  preferred_personality text,
  preferred_speed float,
  preferred_voice_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX voice_settings_user_idx ON public.voice_settings (user_id) WHERE user_id IS NOT NULL;

ALTER TABLE public.voice_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read global voice settings"
  ON public.voice_settings FOR SELECT TO authenticated
  USING (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "Admins can manage global voice settings"
  ON public.voice_settings FOR ALL TO authenticated
  USING (user_id IS NULL AND has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id IS NULL AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Users manage own voice preferences"
  ON public.voice_settings FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER voice_settings_updated_at BEFORE UPDATE ON public.voice_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enforce single global config row
CREATE OR REPLACE FUNCTION enforce_single_global_voice_settings()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    IF EXISTS (SELECT 1 FROM voice_settings WHERE user_id IS NULL AND id != NEW.id) THEN
      RAISE EXCEPTION 'Only one global voice_settings row allowed';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_global_voice_settings
  BEFORE INSERT OR UPDATE ON public.voice_settings
  FOR EACH ROW EXECUTE FUNCTION enforce_single_global_voice_settings();

-- Insert default global config
INSERT INTO public.voice_settings (user_id, assistant_enabled, silence_timeout, confidence_threshold)
  VALUES (NULL, true, 2, 0.70);

-- ============================================================================
-- 2. VOICE ANALYTICS (session tracking)
-- ============================================================================
CREATE TABLE public.voice_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid,
  conversation_id uuid REFERENCES public.voice_conversations(id) ON DELETE SET NULL,
  event_type text NOT NULL,  -- 'session_start','session_end','transcription','response','error'
  metadata jsonb,            -- flexible payload (duration_ms, language, word_count, etc.)
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX voice_analytics_user_date_idx ON public.voice_analytics (user_id, created_at DESC);
CREATE INDEX voice_analytics_event_idx ON public.voice_analytics (event_type, created_at DESC);

ALTER TABLE public.voice_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own voice analytics"
  ON public.voice_analytics FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own voice analytics"
  ON public.voice_analytics FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all voice analytics"
  ON public.voice_analytics FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- ============================================================================
-- 3. VOICE SEARCH LOGS (RAG retrieval tracking)
-- ============================================================================
CREATE TABLE public.voice_search_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.voice_conversations(id) ON DELETE SET NULL,
  query text NOT NULL,
  top_similarity float,
  confidence_score float,
  result_count integer,
  language_detected text,
  response_latency_ms integer,
  was_successful boolean NOT NULL DEFAULT true,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX voice_search_logs_user_date_idx ON public.voice_search_logs (user_id, created_at DESC);
CREATE INDEX voice_search_logs_confidence_idx ON public.voice_search_logs (confidence_score);

ALTER TABLE public.voice_search_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own search logs"
  ON public.voice_search_logs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own search logs"
  ON public.voice_search_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all search logs"
  ON public.voice_search_logs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- ============================================================================
-- 4. ADMIN AGGREGATE VIEW
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_voice_admin_stats()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT jsonb_build_object(
    'total_conversations', (SELECT COUNT(*) FROM voice_conversations),
    'total_messages', (SELECT COUNT(*) FROM voice_messages),
    'total_searches', (SELECT COUNT(*) FROM voice_search_logs),
    'failed_searches', (SELECT COUNT(*) FROM voice_search_logs WHERE NOT was_successful),
    'low_confidence', (SELECT COUNT(*) FROM voice_search_logs WHERE confidence_score < 0.5 AND was_successful),
    'avg_confidence', (SELECT COALESCE(AVG(confidence_score), 0) FROM voice_search_logs WHERE was_successful),
    'avg_latency_ms', (SELECT COALESCE(AVG(response_latency_ms), 0) FROM voice_search_logs),
    'top_queries', (
      SELECT COALESCE(jsonb_agg(q), '[]'::jsonb)
      FROM (
        SELECT query, COUNT(*) as count
        FROM voice_search_logs
        GROUP BY query ORDER BY count DESC LIMIT 10
      ) q
    ),
    'daily_activity', (
      SELECT COALESCE(jsonb_agg(d), '[]'::jsonb)
      FROM (
        SELECT DATE(created_at) as date, COUNT(*) as searches
        FROM voice_search_logs
        WHERE created_at > now() - INTERVAL '30 days'
        GROUP BY DATE(created_at) ORDER BY date DESC
      ) d
    ),
    'language_breakdown', (
      SELECT COALESCE(jsonb_agg(l), '[]'::jsonb)
      FROM (
        SELECT language_detected as language, COUNT(*) as count
        FROM voice_search_logs
        WHERE language_detected IS NOT NULL
        GROUP BY language_detected ORDER BY count DESC
      ) l
    )
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_voice_admin_stats() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_voice_admin_stats() TO authenticated;
