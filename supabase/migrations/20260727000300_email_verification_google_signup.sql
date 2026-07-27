-- Email verification (unverified → pending) + Google signup_method + hashed OTP codes.
-- Existing approved users stay approved. Password signups start unverified; Google starts pending.

-- ─── Extend approval_status to include unverified ───────────────────────────
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_approval_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_approval_status_check
  CHECK (approval_status IN ('unverified', 'pending', 'approved', 'rejected', 'expired'));

-- ─── Signup method (manual email/password vs Google OAuth) ──────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS signup_method TEXT NOT NULL DEFAULT 'manual';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_signup_method_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_signup_method_check
      CHECK (signup_method IN ('manual', 'google'));
  END IF;
END $$;

UPDATE public.profiles
SET signup_method = 'manual'
WHERE signup_method IS NULL OR signup_method = '';

-- ─── Email verification codes (hashed, short TTL) ───────────────────────────
CREATE TABLE IF NOT EXISTS public.email_verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  consumed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS email_verification_codes_user_created_idx
  ON public.email_verification_codes (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS email_verification_codes_user_active_idx
  ON public.email_verification_codes (user_id, expires_at)
  WHERE consumed_at IS NULL;

ALTER TABLE public.email_verification_codes ENABLE ROW LEVEL SECURITY;

-- No direct client access — Edge Functions use service role
DROP POLICY IF EXISTS "No direct access to verification codes" ON public.email_verification_codes;
CREATE POLICY "No direct access to verification codes"
  ON public.email_verification_codes
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

GRANT ALL ON public.email_verification_codes TO service_role;
REVOKE ALL ON public.email_verification_codes FROM PUBLIC;
REVOKE ALL ON public.email_verification_codes FROM anon, authenticated;

-- ─── Signup trigger: Google → pending; email/password → unverified ──────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role app_role;
  _full_name text;
  _provider text;
  _signup_method text;
  _approval_status text;
  _avatar_url text;
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

  _provider := COALESCE(NEW.raw_app_meta_data->>'provider', 'email');
  IF _provider = 'google' THEN
    _signup_method := 'google';
    _approval_status := 'pending';
  ELSE
    _signup_method := 'manual';
    _approval_status := 'unverified';
  END IF;

  _avatar_url := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture',
    NULL
  );

  PERFORM set_config('app.bypass_approval_guard', 'true', true);

  INSERT INTO public.profiles (
    user_id, email, full_name, avatar_url,
    approval_status, signup_requested_at, signup_method
  )
  VALUES (
    NEW.id, NEW.email, _full_name, _avatar_url,
    _approval_status, now(), _signup_method
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

-- ─── After email verify: move unverified → pending (service / edge) ─────────
CREATE OR REPLACE FUNCTION public.mark_email_verified(p_user_id UUID)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_profile public.profiles;
BEGIN
  -- Callable by service_role (edge) or the owning authenticated user
  IF COALESCE(auth.jwt() ->> 'role', '') <> 'service_role'
     AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  PERFORM set_config('app.bypass_approval_guard', 'true', true);

  UPDATE public.profiles
  SET
    approval_status = 'pending',
    signup_requested_at = now(),
    approval_notice = 'Your email is verified. Your account is now waiting for admin approval.',
    updated_at = now()
  WHERE user_id = p_user_id
    AND approval_status = 'unverified'
  RETURNING * INTO updated_profile;

  IF updated_profile.id IS NULL THEN
    SELECT * INTO updated_profile
    FROM public.profiles
    WHERE user_id = p_user_id;
  END IF;

  RETURN updated_profile;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_email_verified(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_email_verified(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_email_verified(UUID) TO authenticated;

-- ─── OAuth post-signup role preferences (Google from Register) ──────────────
CREATE OR REPLACE FUNCTION public.apply_oauth_signup_preferences(
  p_role TEXT,
  p_company_name TEXT DEFAULT NULL
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_profile public.profiles;
  _role app_role;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_role NOT IN ('user', 'recruiter') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  _role := p_role::app_role;

  SELECT * INTO updated_profile
  FROM public.profiles
  WHERE user_id = auth.uid();

  IF updated_profile.id IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  -- Only while awaiting verification/approval, and only for Google signups
  IF updated_profile.approval_status NOT IN ('unverified', 'pending') THEN
    RETURN updated_profile;
  END IF;

  IF updated_profile.signup_method IS DISTINCT FROM 'google' THEN
    RETURN updated_profile;
  END IF;

  -- Do not touch admins
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN updated_profile;
  END IF;

  UPDATE public.user_roles
  SET role = _role
  WHERE user_id = auth.uid();

  IF _role = 'recruiter' THEN
    INSERT INTO public.recruiter_profiles (user_id, company_name)
    VALUES (auth.uid(), COALESCE(p_company_name, ''))
    ON CONFLICT (user_id) DO UPDATE
      SET company_name = COALESCE(NULLIF(EXCLUDED.company_name, ''), public.recruiter_profiles.company_name);
  END IF;

  SELECT * INTO updated_profile
  FROM public.profiles
  WHERE user_id = auth.uid();

  RETURN updated_profile;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_oauth_signup_preferences(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_oauth_signup_preferences(TEXT, TEXT) TO authenticated;

-- Admin approve/reject: block unverified (must verify email first)
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
  current_status TEXT;
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

  SELECT approval_status INTO current_status
  FROM public.profiles
  WHERE user_id = p_user_id;

  IF current_status IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  IF current_status = 'unverified' THEN
    RAISE EXCEPTION 'User must verify their email before approval';
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

  RETURN updated_profile;
END;
$$;

-- 48h expiry still only applies to pending (not unverified)
-- (expire_pending_approvals unchanged)
