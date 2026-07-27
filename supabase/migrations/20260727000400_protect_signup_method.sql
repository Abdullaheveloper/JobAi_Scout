-- Prevent non-admins from changing signup_method after create
CREATE OR REPLACE FUNCTION public.protect_approval_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.bypass_approval_guard', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF COALESCE(auth.jwt() ->> 'role', '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  -- Allow the owner to clear their own approval_notice after viewing it
  IF NEW.approval_status IS NOT DISTINCT FROM OLD.approval_status
     AND NEW.approved_at IS NOT DISTINCT FROM OLD.approved_at
     AND NEW.approved_by IS NOT DISTINCT FROM OLD.approved_by
     AND NEW.signup_requested_at IS NOT DISTINCT FROM OLD.signup_requested_at
     AND NEW.signup_method IS NOT DISTINCT FROM OLD.signup_method
     AND NEW.approval_notice IS NULL
     AND OLD.approval_notice IS NOT NULL
     AND auth.uid() = NEW.user_id THEN
    RETURN NEW;
  END IF;

  IF NEW.approval_status IS DISTINCT FROM OLD.approval_status
     OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
     OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
     OR NEW.signup_requested_at IS DISTINCT FROM OLD.signup_requested_at
     OR NEW.signup_method IS DISTINCT FROM OLD.signup_method
     OR NEW.approval_notice IS DISTINCT FROM OLD.approval_notice THEN
    RAISE EXCEPTION 'Only admins can modify account approval fields';
  END IF;

  RETURN NEW;
END;
$$;
