-- Admin cascade delete support: audit log (never cascade-deleted with the user)
-- plus cleanup helpers for tables without auth.users FKs.

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL,
  admin_email TEXT,
  action TEXT NOT NULL,
  target_user_id UUID,
  target_user_email TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Intentionally NO FK from admin_id/target_user_id → auth.users so deleting
-- a user never removes the audit trail of that deletion.

CREATE INDEX IF NOT EXISTS admin_audit_log_created_at_idx
  ON public.admin_audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS admin_audit_log_action_idx
  ON public.admin_audit_log (action);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read audit log" ON public.admin_audit_log;
CREATE POLICY "Admins can read audit log"
  ON public.admin_audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Inserts happen via service role from the delete-user edge function only.
REVOKE ALL ON TABLE public.admin_audit_log FROM PUBLIC;
GRANT SELECT ON TABLE public.admin_audit_log TO authenticated;
GRANT ALL ON TABLE public.admin_audit_log TO service_role;

-- Ensure recruiter-owned jobs can be cleaned up (no FK today).
-- When a recruiter is deleted, the edge function deletes their jobs first;
-- job_applications / questions cascade from jobs.

-- Add ON DELETE CASCADE for candidate_notes / messages where missing would
-- otherwise leave orphans. Safe additive FKs:
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'candidate_notes_recruiter_id_fkey'
  ) THEN
    -- Clean orphans first
    DELETE FROM public.candidate_notes cn
    WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = cn.recruiter_id);

    ALTER TABLE public.candidate_notes
      ADD CONSTRAINT candidate_notes_recruiter_id_fkey
      FOREIGN KEY (recruiter_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'candidate_notes_candidate_id_fkey'
  ) THEN
    DELETE FROM public.candidate_notes cn
    WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = cn.candidate_id);

    ALTER TABLE public.candidate_notes
      ADD CONSTRAINT candidate_notes_candidate_id_fkey
      FOREIGN KEY (candidate_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'candidate_notes FK setup skipped: %', SQLERRM;
END $$;

-- Soft-link jobs.recruiter_id: SET NULL on user delete if we add FK later.
-- Edge function deletes recruiter jobs explicitly before auth delete.
