-- Remove Google OAuth + email verification code features.
-- Restore password signups to pending (admin approval) only.
-- Existing approved/rejected/expired users are left unchanged.
-- Any leftover "unverified" profiles move to pending so they enter the approval queue.

-- ─── Move stuck unverified users into the pending approval queue ────────────
DO $$
BEGIN
  PERFORM set_config('app.bypass_approval_guard', 'true', true);

  UPDATE public.profiles
  SET
    approval_status = 'pending',
    signup_requested_at = COALESCE(signup_requested_at, now()),
    approval_notice = COALESCE(
      approval_notice,
      'Your account is waiting for admin approval. Please wait.'
    ),
    updated_at = now()
  WHERE approval_status = 'unverified';
END $$;

-- ─── Drop email verification codes + RPCs ───────────────────────────────────
DROP TABLE IF EXISTS public.email_verification_codes CASCADE;

DROP FUNCTION IF EXISTS public.mark_email_verified(UUID);
DROP FUNCTION IF EXISTS public.apply_oauth_signup_preferences(TEXT, TEXT);

-- ─── Tighten approval_status (no unverified) ────────────────────────────────
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_approval_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_approval_status_check
  CHECK (approval_status IN ('pending', 'approved', 'rejected', 'expired'));

-- ─── Drop signup_method (Google vs manual) ──────────────────────────────────
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_signup_method_check;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS signup_method;

-- ─── Signup trigger: all password signups start pending ─────────────────────
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

-- ─── Admin approve/reject without unverified gate ───────────────────────────
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

-- ─── Restore protect_approval_columns without signup_method ─────────────────
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
