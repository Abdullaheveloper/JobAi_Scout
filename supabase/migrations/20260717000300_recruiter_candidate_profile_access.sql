-- A recruiter may read an applicant profile only when the applicant has
-- applied to one of that recruiter's jobs. This is intentionally narrower
-- than making profiles broadly visible to all recruiters.
CREATE POLICY "Recruiters can view profiles of applicants to own jobs"
  ON public.profiles
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.job_applications application
    JOIN public.jobs job ON job.id = application.job_id
    WHERE application.user_id = profiles.user_id
      AND job.recruiter_id = auth.uid()
  ));
