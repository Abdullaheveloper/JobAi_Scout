-- Durable, user-specific job history. This is deliberately separate from jobs
-- so global job records, scraping, matching, and deduplication remain unchanged.
CREATE TABLE IF NOT EXISTS public.job_user_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
  recommended_job_id UUID REFERENCES public.recommended_jobs(id) ON DELETE CASCADE,
  first_viewed_at TIMESTAMPTZ,
  last_viewed_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  first_saved_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT job_user_interactions_one_job CHECK (num_nonnulls(job_id,recommended_job_id)=1)
);

CREATE UNIQUE INDEX IF NOT EXISTS job_user_interactions_user_job_uidx
  ON public.job_user_interactions(user_id,job_id) WHERE job_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS job_user_interactions_user_recommended_uidx
  ON public.job_user_interactions(user_id,recommended_job_id) WHERE recommended_job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS job_user_interactions_user_updated_idx
  ON public.job_user_interactions(user_id,updated_at DESC);

ALTER TABLE public.job_user_interactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own job interactions" ON public.job_user_interactions;
CREATE POLICY "Users manage own job interactions" ON public.job_user_interactions
  FOR ALL TO authenticated USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid());

CREATE OR REPLACE FUNCTION public.mark_job_interaction(
  p_job_id UUID,
  p_action TEXT,
  p_recommended BOOLEAN DEFAULT false
) RETURNS public.job_user_interactions
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE result public.job_user_interactions;
BEGIN
  IF p_action NOT IN ('viewed','opened') THEN
    RAISE EXCEPTION 'Unsupported job interaction';
  END IF;

  IF p_recommended THEN
    INSERT INTO job_user_interactions(user_id,recommended_job_id,first_viewed_at,last_viewed_at,opened_at)
    VALUES (auth.uid(),p_job_id,now(),now(),CASE WHEN p_action='opened' THEN now() END)
    ON CONFLICT (user_id,recommended_job_id) WHERE recommended_job_id IS NOT NULL DO UPDATE SET
      first_viewed_at=COALESCE(job_user_interactions.first_viewed_at,now()),
      last_viewed_at=now(),
      opened_at=CASE WHEN p_action='opened' THEN COALESCE(job_user_interactions.opened_at,now()) ELSE job_user_interactions.opened_at END,
      updated_at=now()
    RETURNING * INTO result;
  ELSE
    INSERT INTO job_user_interactions(user_id,job_id,first_viewed_at,last_viewed_at,opened_at)
    VALUES (auth.uid(),p_job_id,now(),now(),CASE WHEN p_action='opened' THEN now() END)
    ON CONFLICT (user_id,job_id) WHERE job_id IS NOT NULL DO UPDATE SET
      first_viewed_at=COALESCE(job_user_interactions.first_viewed_at,now()),
      last_viewed_at=now(),
      opened_at=CASE WHEN p_action='opened' THEN COALESCE(job_user_interactions.opened_at,now()) ELSE job_user_interactions.opened_at END,
      updated_at=now()
    RETURNING * INTO result;
  END IF;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.mark_job_interaction(UUID,TEXT,BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_job_interaction(UUID,TEXT,BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.sync_saved_job_interaction() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.job_id IS NOT NULL THEN
    INSERT INTO job_user_interactions(user_id,job_id,first_saved_at)
    VALUES (NEW.user_id,NEW.job_id,COALESCE(NEW.saved_at,now()))
    ON CONFLICT (user_id,job_id) WHERE job_id IS NOT NULL DO UPDATE SET
      first_saved_at=COALESCE(job_user_interactions.first_saved_at,EXCLUDED.first_saved_at),updated_at=now();
  ELSIF NEW.recommended_job_id IS NOT NULL THEN
    INSERT INTO job_user_interactions(user_id,recommended_job_id,first_saved_at)
    VALUES (NEW.user_id,NEW.recommended_job_id,COALESCE(NEW.saved_at,now()))
    ON CONFLICT (user_id,recommended_job_id) WHERE recommended_job_id IS NOT NULL DO UPDATE SET
      first_saved_at=COALESCE(job_user_interactions.first_saved_at,EXCLUDED.first_saved_at),updated_at=now();
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS sync_saved_job_interaction_trigger ON public.saved_jobs;
CREATE TRIGGER sync_saved_job_interaction_trigger AFTER INSERT ON public.saved_jobs
FOR EACH ROW EXECUTE FUNCTION public.sync_saved_job_interaction();

CREATE OR REPLACE FUNCTION public.sync_applied_job_interaction() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO job_user_interactions(user_id,job_id,applied_at)
  VALUES (NEW.user_id,NEW.job_id,COALESCE(NEW.applied_at,now()))
  ON CONFLICT (user_id,job_id) WHERE job_id IS NOT NULL DO UPDATE SET
    applied_at=COALESCE(job_user_interactions.applied_at,EXCLUDED.applied_at),updated_at=now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS sync_applied_job_interaction_trigger ON public.job_applications;
CREATE TRIGGER sync_applied_job_interaction_trigger AFTER INSERT ON public.job_applications
FOR EACH ROW EXECUTE FUNCTION public.sync_applied_job_interaction();

-- Backfill current saves and applications so the feature is useful immediately.
INSERT INTO job_user_interactions(user_id,job_id,first_saved_at)
SELECT user_id,job_id,COALESCE(saved_at,now()) FROM saved_jobs WHERE job_id IS NOT NULL
ON CONFLICT (user_id,job_id) WHERE job_id IS NOT NULL DO UPDATE SET first_saved_at=COALESCE(job_user_interactions.first_saved_at,EXCLUDED.first_saved_at);
INSERT INTO job_user_interactions(user_id,recommended_job_id,first_saved_at)
SELECT user_id,recommended_job_id,COALESCE(saved_at,now()) FROM saved_jobs WHERE recommended_job_id IS NOT NULL
ON CONFLICT (user_id,recommended_job_id) WHERE recommended_job_id IS NOT NULL DO UPDATE SET first_saved_at=COALESCE(job_user_interactions.first_saved_at,EXCLUDED.first_saved_at);
INSERT INTO job_user_interactions(user_id,job_id,applied_at)
SELECT user_id,job_id,COALESCE(applied_at,now()) FROM job_applications
ON CONFLICT (user_id,job_id) WHERE job_id IS NOT NULL DO UPDATE SET applied_at=COALESCE(job_user_interactions.applied_at,EXCLUDED.applied_at);
