-- Account approval gate: new signups stay pending until an admin approves.
-- Existing users (including admins) are backfilled as approved so nobody is locked out.

-- ─── Columns ───────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS signup_requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS approval_notice TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_approval_status_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_approval_status_check
      CHECK (approval_status IN ('pending', 'approved', 'rejected', 'expired'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS profiles_approval_status_idx
  ON public.profiles (approval_status);

CREATE INDEX IF NOT EXISTS profiles_pending_signup_requested_idx
  ON public.profiles (signup_requested_at)
  WHERE approval_status = 'pending';

-- Backfill: every existing profile is approved (do not lock out current users/admins)
UPDATE public.profiles
SET
  approval_status = 'approved',
  approved_at = COALESCE(approved_at, created_at, now()),
  signup_requested_at = COALESCE(signup_requested_at, created_at, now())
WHERE approval_status IS DISTINCT FROM 'approved'
   OR approved_at IS NULL;

-- ─── Guard: non-admins cannot change approval fields (except dismiss notice) ─
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

  -- Service-role / edge functions (e.g. manage-role promote) bypass the guard
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
     AND NEW.approval_notice IS NULL
     AND OLD.approval_notice IS NOT NULL
     AND auth.uid() = NEW.user_id THEN
    RETURN NEW;
  END IF;

  IF NEW.approval_status IS DISTINCT FROM OLD.approval_status
     OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
     OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
     OR NEW.signup_requested_at IS DISTINCT FROM OLD.signup_requested_at
     OR NEW.approval_notice IS DISTINCT FROM OLD.approval_notice THEN
    RAISE EXCEPTION 'Only admins can modify account approval fields';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_approval_columns_trg ON public.profiles;
CREATE TRIGGER protect_approval_columns_trg
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_approval_columns();

-- ─── Signup trigger: new users start pending (never trust metadata for admin) ─
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role app_role;
  _full_name text;
BEGIN
  -- Never allow self-signup as admin via metadata
  _role := COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'user');
  IF _role = 'admin' THEN
    _role := 'user';
  END IF;

  _full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'user_name',
    ''
  );

  PERFORM set_config('app.bypass_approval_guard', 'true', true);

  INSERT INTO public.profiles (
    user_id, email, full_name,
    approval_status, signup_requested_at
  )
  VALUES (
    NEW.id, NEW.email, _full_name,
    'pending', now()
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _role);

  IF _role = 'recruiter' THEN
    INSERT INTO public.recruiter_profiles (user_id, company_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'company_name', ''));
  END IF;

  RETURN NEW;
END;
$$;

-- ─── Admin approve / reject ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_set_account_approval(
  p_user_id UUID,
  p_status TEXT
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_profile public.profiles;
  notice_text TEXT;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;

  IF p_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status. Use approved or rejected.';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot change your own approval status';
  END IF;

  IF p_status = 'approved' THEN
    notice_text := 'Your account has been approved. You can now log in.';
  ELSE
    notice_text := 'Your account approval request was rejected. Please contact support or try again later.';
  END IF;

  PERFORM set_config('app.bypass_approval_guard', 'true', true);

  UPDATE public.profiles
  SET
    approval_status = p_status,
    approved_at = CASE WHEN p_status = 'approved' THEN now() ELSE NULL END,
    approved_by = CASE WHEN p_status = 'approved' THEN auth.uid() ELSE NULL END,
    approval_notice = notice_text,
    updated_at = now()
  WHERE user_id = p_user_id
  RETURNING * INTO updated_profile;

  IF updated_profile.id IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  RETURN updated_profile;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_account_approval(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_account_approval(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_account_approval(UUID, TEXT) TO service_role;

-- ─── Expired / rejected users can re-request on login ──────────────────────
CREATE OR REPLACE FUNCTION public.renew_approval_request()
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_profile public.profiles;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM set_config('app.bypass_approval_guard', 'true', true);

  UPDATE public.profiles
  SET
    approval_status = 'pending',
    signup_requested_at = now(),
    approved_at = NULL,
    approved_by = NULL,
    approval_notice = NULL,
    updated_at = now()
  WHERE user_id = auth.uid()
    AND approval_status IN ('expired', 'rejected')
  RETURNING * INTO updated_profile;

  IF updated_profile.id IS NULL THEN
    SELECT * INTO updated_profile
    FROM public.profiles
    WHERE user_id = auth.uid();
  END IF;

  RETURN updated_profile;
END;
$$;

REVOKE ALL ON FUNCTION public.renew_approval_request() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.renew_approval_request() TO authenticated;
GRANT EXECUTE ON FUNCTION public.renew_approval_request() TO service_role;

-- ─── Clear approval banner after user sees it ──────────────────────────────
CREATE OR REPLACE FUNCTION public.clear_approval_notice()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM set_config('app.bypass_approval_guard', 'true', true);

  UPDATE public.profiles
  SET approval_notice = NULL, updated_at = now()
  WHERE user_id = auth.uid()
    AND approval_notice IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.clear_approval_notice() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_approval_notice() TO authenticated;

-- ─── 48h expiry job ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.expire_pending_approvals()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  PERFORM set_config('app.bypass_approval_guard', 'true', true);

  UPDATE public.profiles
  SET
    approval_status = 'expired',
    approval_notice = 'Your approval request expired. Please try logging in again.',
    updated_at = now()
  WHERE approval_status = 'pending'
    AND signup_requested_at < (now() - INTERVAL '48 hours');

  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_pending_approvals() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_pending_approvals() TO service_role;

-- Hourly cron: expire pending approvals older than 48 hours.
-- Also document Edge Function `expire-pending-approvals` for external/manual runs
-- (schedule: 15 * * * *). Prefer this SQL cron; the Edge Function uses the same RPC.
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule('expire-pending-approvals');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'expire-pending-approvals',
  '15 * * * *',
  $$SELECT public.expire_pending_approvals();$$
);
