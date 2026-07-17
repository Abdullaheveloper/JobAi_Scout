-- Keep application status simple, predictable, and private-note based.
UPDATE public.job_applications
SET status = 'new'
WHERE status IS NULL OR status = 'applied';

ALTER TABLE public.job_applications
  ALTER COLUMN status SET DEFAULT 'new';

ALTER TABLE public.job_applications
  DROP CONSTRAINT IF EXISTS job_applications_status_check;

ALTER TABLE public.job_applications
  ADD CONSTRAINT job_applications_status_check
  CHECK (status IN ('new', 'shortlisted', 'rejected', 'hired'));

-- Explicitly prevent a recruiter from changing the applicant or job while
-- reviewing an application. They may only update status/related fields on jobs
-- they own.
DROP POLICY IF EXISTS "Recruiters can update applications to their jobs" ON public.job_applications;
CREATE POLICY "Recruiters can update applications to their jobs"
  ON public.job_applications
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.jobs
    WHERE jobs.id = job_applications.job_id
      AND jobs.recruiter_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.jobs
    WHERE jobs.id = job_applications.job_id
      AND jobs.recruiter_id = auth.uid()
  ));

CREATE POLICY "Recruiters can view applications to their jobs"
  ON public.job_applications
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.jobs
    WHERE jobs.id = job_applications.job_id
      AND jobs.recruiter_id = auth.uid()
  ));
