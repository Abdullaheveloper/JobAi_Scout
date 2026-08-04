-- The application cannot observe completion on a third-party site, so an
-- explicit click on the existing Apply action is the durable applied signal.
CREATE OR REPLACE FUNCTION public.mark_job_interaction(
  p_job_id UUID,
  p_action TEXT,
  p_recommended BOOLEAN DEFAULT false
) RETURNS public.job_user_interactions
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE result public.job_user_interactions;
BEGIN
  IF p_action NOT IN ('viewed','opened','applied') THEN
    RAISE EXCEPTION 'Unsupported job interaction';
  END IF;

  IF p_recommended THEN
    INSERT INTO job_user_interactions(user_id,recommended_job_id,first_viewed_at,last_viewed_at,opened_at,applied_at)
    VALUES (auth.uid(),p_job_id,now(),now(),CASE WHEN p_action IN ('opened','applied') THEN now() END,CASE WHEN p_action='applied' THEN now() END)
    ON CONFLICT (user_id,recommended_job_id) WHERE recommended_job_id IS NOT NULL DO UPDATE SET
      first_viewed_at=COALESCE(job_user_interactions.first_viewed_at,now()),last_viewed_at=now(),
      opened_at=CASE WHEN p_action IN ('opened','applied') THEN COALESCE(job_user_interactions.opened_at,now()) ELSE job_user_interactions.opened_at END,
      applied_at=CASE WHEN p_action='applied' THEN COALESCE(job_user_interactions.applied_at,now()) ELSE job_user_interactions.applied_at END,updated_at=now()
    RETURNING * INTO result;
  ELSE
    INSERT INTO job_user_interactions(user_id,job_id,first_viewed_at,last_viewed_at,opened_at,applied_at)
    VALUES (auth.uid(),p_job_id,now(),now(),CASE WHEN p_action IN ('opened','applied') THEN now() END,CASE WHEN p_action='applied' THEN now() END)
    ON CONFLICT (user_id,job_id) WHERE job_id IS NOT NULL DO UPDATE SET
      first_viewed_at=COALESCE(job_user_interactions.first_viewed_at,now()),last_viewed_at=now(),
      opened_at=CASE WHEN p_action IN ('opened','applied') THEN COALESCE(job_user_interactions.opened_at,now()) ELSE job_user_interactions.opened_at END,
      applied_at=CASE WHEN p_action='applied' THEN COALESCE(job_user_interactions.applied_at,now()) ELSE job_user_interactions.applied_at END,updated_at=now()
    RETURNING * INTO result;
  END IF;
  RETURN result;
END $$;
