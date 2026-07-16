-- Truthful applicant-provided preferences used by the browser form-fill extension.
-- `application_answers` maps a stable question phrase to the answer to select,
-- for example: {"deployed and debugged an application on a linux server": "Yes"}.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS work_authorization TEXT,
  ADD COLUMN IF NOT EXISTS willing_to_relocate TEXT,
  ADD COLUMN IF NOT EXISTS availability TEXT,
  ADD COLUMN IF NOT EXISTS work_type TEXT,
  ADD COLUMN IF NOT EXISTS application_answers JSONB NOT NULL DEFAULT '{}'::jsonb;
