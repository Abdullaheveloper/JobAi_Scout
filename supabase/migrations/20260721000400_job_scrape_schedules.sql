-- User-configurable automation schedules for the existing job-scrape pipeline.
-- One system-wide pg_cron tick dispatches all due schedules; it never runs
-- adapter logic itself — it only claims due rows and invokes the same
-- orchestration the manual "Scrape Jobs" button uses (see
-- supabase/functions/_shared/scrape-orchestrator.ts).
--
-- Recurrence design: 'days_of_week' is the single stored representation for
-- both the "Weekly" and "Specific days" UI modes (a weekly schedule is just a
-- days_of_week array with one entry) — there is no behavioral difference in
-- next-run math between the two, so no separate DB value is created for
-- "weekly". 'once' and 'monthly_once' are kept distinct (both user-facing
-- concepts per spec) but share the same run_date column and the same
-- single-fire/auto-deactivate behavior.

CREATE TABLE public.job_scrape_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),

  recurrence_type TEXT NOT NULL CHECK (
    recurrence_type IN ('once', 'daily', 'days_of_week', 'monthly_repeat', 'monthly_once')
  ),

  time_of_day TIME NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',

  days_of_week SMALLINT[],   -- 'days_of_week' only; 0=Sunday..6=Saturday (matches Postgres EXTRACT(DOW))
  day_of_month SMALLINT CHECK (day_of_month BETWEEN 1 AND 31), -- 'monthly_repeat' only
  run_date DATE,             -- 'once' / 'monthly_once' only

  is_active BOOLEAN NOT NULL DEFAULT true,
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  last_run_status TEXT CHECK (
    last_run_status IS NULL OR last_run_status IN (
      'dispatched', 'completed', 'partially_completed', 'failed',
      'stopped', 'skipped_conflict', 'skipped_no_query'
    )
  ),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT job_scrape_schedules_fields_valid CHECK (
    (recurrence_type IN ('once', 'monthly_once')
       AND run_date IS NOT NULL AND days_of_week IS NULL AND day_of_month IS NULL)
    OR (recurrence_type = 'daily'
       AND run_date IS NULL AND days_of_week IS NULL AND day_of_month IS NULL)
    OR (recurrence_type = 'days_of_week'
       AND days_of_week IS NOT NULL AND cardinality(days_of_week) BETWEEN 1 AND 7
       AND days_of_week <@ ARRAY[0,1,2,3,4,5,6]::smallint[]
       AND run_date IS NULL AND day_of_month IS NULL)
    OR (recurrence_type = 'monthly_repeat'
       AND day_of_month IS NOT NULL AND run_date IS NULL AND days_of_week IS NULL)
  )
);

CREATE INDEX job_scrape_schedules_user_idx ON public.job_scrape_schedules (user_id);

-- The one index the per-minute cron dispatch relies on: a partial index
-- scoped to exactly the rows that can ever be "due", ordered by due time.
CREATE INDEX job_scrape_schedules_due_idx
  ON public.job_scrape_schedules (next_run_at)
  WHERE is_active;

ALTER TABLE public.job_scrape_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own job scrape schedules"
  ON public.job_scrape_schedules FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_scrape_schedules TO authenticated;
GRANT ALL ON public.job_scrape_schedules TO service_role;

DROP TRIGGER IF EXISTS update_job_scrape_schedules_updated_at ON public.job_scrape_schedules;
CREATE TRIGGER update_job_scrape_schedules_updated_at
  BEFORE UPDATE ON public.job_scrape_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Traceability: which schedule (if any) started a given session.
ALTER TABLE public.job_scrape_sessions
  ADD COLUMN schedule_id UUID REFERENCES public.job_scrape_schedules(id) ON DELETE SET NULL;
CREATE INDEX job_scrape_sessions_schedule_idx
  ON public.job_scrape_sessions (schedule_id) WHERE schedule_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- Next-run computation — single source of truth, timezone-correct.
-- `AT TIME ZONE` interprets a naive local timestamp using that IANA zone's
-- rules for that specific calendar date, so DST offsets are applied
-- correctly per-date without any manual date math.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.compute_job_scrape_next_run_at(
  p_recurrence_type TEXT,
  p_time_of_day TIME,
  p_timezone TEXT,
  p_days_of_week SMALLINT[],
  p_day_of_month SMALLINT,
  p_run_date DATE,
  p_after TIMESTAMPTZ DEFAULT now()
) RETURNS TIMESTAMPTZ
LANGUAGE plpgsql STABLE AS $$
DECLARE
  local_after TIMESTAMP;
  candidate_date DATE;
  candidate_utc TIMESTAMPTZ;
  i INTEGER;
  month_start DATE;
  last_day INTEGER;
BEGIN
  local_after := p_after AT TIME ZONE p_timezone;

  IF p_recurrence_type IN ('once', 'monthly_once') THEN
    RETURN (p_run_date::timestamp + p_time_of_day) AT TIME ZONE p_timezone;
  END IF;

  IF p_recurrence_type = 'daily' THEN
    candidate_date := local_after::date;
    candidate_utc := (candidate_date + p_time_of_day) AT TIME ZONE p_timezone;
    IF candidate_utc <= p_after THEN candidate_date := candidate_date + 1; END IF;
    RETURN (candidate_date + p_time_of_day) AT TIME ZONE p_timezone;
  END IF;

  IF p_recurrence_type = 'days_of_week' THEN
    FOR i IN 0..7 LOOP
      candidate_date := local_after::date + i;
      IF EXTRACT(DOW FROM candidate_date)::smallint = ANY (p_days_of_week) THEN
        candidate_utc := (candidate_date + p_time_of_day) AT TIME ZONE p_timezone;
        IF candidate_utc > p_after THEN RETURN candidate_utc; END IF;
      END IF;
    END LOOP;
    RAISE EXCEPTION 'compute_job_scrape_next_run_at: no matching day_of_week within 7 days';
  END IF;

  IF p_recurrence_type = 'monthly_repeat' THEN
    FOR i IN 0..2 LOOP -- this month, next month, month after: safety bound
      month_start := date_trunc('month', local_after::date + (i || ' months')::interval)::date;
      last_day := EXTRACT(DAY FROM (month_start + interval '1 month - 1 day'))::integer;
      -- Short-month clamping: day_of_month=31 on a 30/28/29-day month runs on that month's last day.
      candidate_date := month_start + (LEAST(p_day_of_month, last_day) - 1);
      candidate_utc := (candidate_date + p_time_of_day) AT TIME ZONE p_timezone;
      IF candidate_utc > p_after THEN RETURN candidate_utc; END IF;
    END LOOP;
    RAISE EXCEPTION 'compute_job_scrape_next_run_at: could not resolve monthly_repeat';
  END IF;

  RAISE EXCEPTION 'compute_job_scrape_next_run_at: unknown recurrence_type %', p_recurrence_type;
END;
$$;

-- Pure calculation, no table access — safe to expose so the UI can preview
-- "next run" for an unsaved form without persisting a row first.
GRANT EXECUTE ON FUNCTION public.compute_job_scrape_next_run_at
  (TEXT, TIME, TEXT, SMALLINT[], SMALLINT, DATE, TIMESTAMPTZ) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_job_scrape_schedule_next_run()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM now() AT TIME ZONE NEW.timezone; -- fail fast on an invalid IANA name
  NEW.next_run_at := CASE WHEN NEW.is_active
    THEN public.compute_job_scrape_next_run_at(
      NEW.recurrence_type, NEW.time_of_day, NEW.timezone,
      NEW.days_of_week, NEW.day_of_month, NEW.run_date, now())
    ELSE NULL END;
  RETURN NEW;
END;
$$;

-- Recomputes next_run_at whenever the schedule's own definition changes.
-- Deliberately does NOT watch is_active (see the dedicated toggle trigger
-- below) so that claim_due_job_scrape_schedules()'s roll-forward update
-- (which uses the exact slot that just fired, not now()) is never clobbered
-- by this trigger recomputing from now() instead.
CREATE TRIGGER job_scrape_schedules_set_next_run
  BEFORE INSERT OR UPDATE OF recurrence_type, time_of_day, timezone,
    days_of_week, day_of_month, run_date
  ON public.job_scrape_schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_job_scrape_schedule_next_run();

-- Handles pause/resume via the UI's enable/disable Switch: pausing clears
-- next_run_at, resuming recomputes it fresh from now(). Scoped separately
-- from the trigger above so the claim function's own is_active=false write
-- (for one-time schedules deactivating after they fire) composes safely --
-- it lands in the "turning off" branch here, which just re-sets NULL, same
-- value the claim function already wrote in that same statement.
CREATE OR REPLACE FUNCTION public.toggle_job_scrape_schedule_active()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_active AND NOT OLD.is_active THEN
    NEW.next_run_at := public.compute_job_scrape_next_run_at(
      NEW.recurrence_type, NEW.time_of_day, NEW.timezone,
      NEW.days_of_week, NEW.day_of_month, NEW.run_date, now());
  ELSIF NOT NEW.is_active THEN
    NEW.next_run_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER job_scrape_schedules_toggle_active
  BEFORE UPDATE OF is_active ON public.job_scrape_schedules
  FOR EACH ROW EXECUTE FUNCTION public.toggle_job_scrape_schedule_active();

-- ─────────────────────────────────────────────────────────────────────────
-- One-pass claim: a single indexed scan (job_scrape_schedules_due_idx) finds
-- everything due, SKIP LOCKED avoids double-claiming if a slow previous tick
-- is still mid-transaction, and next_run_at is advanced (or the schedule
-- deactivated, for one-time types) atomically in the same transaction as the
-- claim -- so a schedule stops being "due" the instant it's claimed, even
-- though the actual scrape it triggers may run for several minutes.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.claim_due_job_scrape_schedules(p_limit INTEGER DEFAULT 25)
RETURNS SETOF public.job_scrape_schedules
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.job_scrape_schedules%ROWTYPE;
  updated public.job_scrape_schedules%ROWTYPE;
BEGIN
  FOR r IN
    SELECT * FROM public.job_scrape_schedules
    WHERE is_active = true AND next_run_at <= now()
    ORDER BY next_run_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  LOOP
    IF r.recurrence_type IN ('once', 'monthly_once') THEN
      UPDATE public.job_scrape_schedules
      SET last_run_at = now(), last_run_status = 'dispatched',
          is_active = false, next_run_at = NULL
      WHERE id = r.id
      RETURNING * INTO updated;
    ELSE
      UPDATE public.job_scrape_schedules
      SET last_run_at = now(), last_run_status = 'dispatched',
          next_run_at = public.compute_job_scrape_next_run_at(
            r.recurrence_type, r.time_of_day, r.timezone,
            r.days_of_week, r.day_of_month, r.run_date, r.next_run_at) -- roll forward from the slot that fired, not now()
      WHERE id = r.id
      RETURNING * INTO updated;
    END IF;
    RETURN NEXT updated;
  END LOOP;
END;
$$;

-- This is the single most important lockdown in this migration: without the
-- REVOKE, any authenticated user could call this via supabase.rpc(...) and
-- force-trigger (and read) every other user's due schedules.
REVOKE ALL ON FUNCTION public.claim_due_job_scrape_schedules(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_due_job_scrape_schedules(INTEGER) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- Cron wiring. Secrets are intentionally NOT set here -- they must be created
-- once via `select vault.create_secret(...)` for 'edge_function_base_url' and
-- 'cron_dispatch_secret', and as the CRON_DISPATCH_SECRET edge function
-- secret (matching 'cron_dispatch_secret''s value). Nothing below embeds a
-- real secret or URL; the cron job below no-ops until both vault secrets exist.
-- ─────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'dispatch-job-scrape-schedules',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'edge_function_base_url' LIMIT 1)
           || '/run-scheduled-scrapes',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_dispatch_secret' LIMIT 1)
    ),
    body := '{}'::jsonb
  )
  WHERE EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'edge_function_base_url')
    AND EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'cron_dispatch_secret');
  $$
);
