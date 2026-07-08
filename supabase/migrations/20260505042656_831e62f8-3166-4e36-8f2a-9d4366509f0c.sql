
CREATE TABLE public.applied_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_title text NOT NULL,
  company text,
  job_url text NOT NULL,
  platform text,
  applied_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, job_url)
);

ALTER TABLE public.applied_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own applied jobs"
  ON public.applied_jobs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own applied jobs"
  ON public.applied_jobs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all applied jobs"
  ON public.applied_jobs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_applied_jobs_user_date ON public.applied_jobs(user_id, applied_at DESC);

CREATE TABLE public.security_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email text,
  attempted_email text,
  page_url text,
  platform text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own alerts"
  ON public.security_alerts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all alerts"
  ON public.security_alerts FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_security_alerts_user_date ON public.security_alerts(user_id, created_at DESC);
