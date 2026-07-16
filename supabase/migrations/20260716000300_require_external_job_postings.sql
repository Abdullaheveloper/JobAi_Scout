-- Scraped listings must always take candidates to a real external posting.
-- Recruiter-created jobs remain active because they are applied to inside JobAI Scout.
UPDATE public.jobs
SET is_active = false,
    status = 'inactive'
WHERE recruiter_id IS NULL
  AND (source_url IS NULL OR source_url !~* '^https?://');

