-- Durable assistant confirmations and user-owned notification rules.
CREATE TABLE IF NOT EXISTS public.assistant_pending_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tool_name text NOT NULL,
  parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  permission_tier text NOT NULL CHECK (permission_tier IN ('confirm', 'strong_confirm')),
  scope_summary text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'expired', 'executed')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  created_at timestamptz NOT NULL DEFAULT now(),
  executed_at timestamptz
);

ALTER TABLE public.assistant_pending_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own assistant actions" ON public.assistant_pending_actions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
REVOKE ALL ON public.assistant_pending_actions FROM anon, authenticated;
GRANT SELECT ON public.assistant_pending_actions TO authenticated;
GRANT ALL ON public.assistant_pending_actions TO service_role;
CREATE INDEX assistant_pending_actions_user_status_idx
  ON public.assistant_pending_actions(user_id, status, expires_at DESC);

CREATE TABLE IF NOT EXISTS public.assistant_notification_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  criteria jsonb NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.assistant_notification_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own assistant notification rules" ON public.assistant_notification_rules
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistant_notification_rules TO authenticated;
CREATE INDEX assistant_notification_rules_user_idx ON public.assistant_notification_rules(user_id, created_at DESC);

ALTER TABLE public.job_scrape_schedules
  ADD COLUMN IF NOT EXISTS cron_expression text,
  ADD COLUMN IF NOT EXISTS action jsonb NOT NULL DEFAULT '{"type":"scrape_jobs"}'::jsonb,
  ADD COLUMN IF NOT EXISTS starts_at timestamptz;
