-- Rank collected jobs consistently with the RSS / Company Careers collector.
-- A role must reach a 30% weighted title/skills/description match and have at
-- least one search term in its title or skills.
CREATE OR REPLACE FUNCTION public.search_collected_jobs(
  p_terms TEXT[] DEFAULT ARRAY[]::TEXT[],
  p_source TEXT DEFAULT NULL,
  p_location TEXT DEFAULT NULL,
  p_job_type TEXT DEFAULT NULL,
  p_work_mode TEXT DEFAULT NULL,
  p_strict_match BOOLEAN DEFAULT FALSE,
  p_limit INTEGER DEFAULT 30,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  company TEXT,
  location TEXT,
  description TEXT,
  skills TEXT[],
  job_type TEXT,
  work_mode TEXT,
  source TEXT,
  source_url TEXT,
  recruiter_id UUID,
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  match_score NUMERIC,
  total_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH normalized_terms AS (
    SELECT ARRAY(
      SELECT DISTINCT lower(trim(term))
      FROM unnest(COALESCE(p_terms, ARRAY[]::TEXT[])) AS term
      WHERE length(trim(term)) >= 2
      LIMIT 4
    ) AS terms
  ), scored AS (
    SELECT
      j.*,
      CASE WHEN cardinality(nt.terms) = 0 THEN 0::NUMERIC ELSE
        (
          (SELECT count(*)::NUMERIC / cardinality(nt.terms) FROM unnest(nt.terms) term WHERE lower(COALESCE(j.title, '')) LIKE '%' || term || '%') * 50
          + (SELECT count(*)::NUMERIC / cardinality(nt.terms) FROM unnest(nt.terms) term WHERE lower(COALESCE(array_to_string(j.skills, ' '), '')) LIKE '%' || term || '%') * 30
          + (SELECT count(*)::NUMERIC / cardinality(nt.terms) FROM unnest(nt.terms) term WHERE lower(COALESCE(j.description, '')) LIKE '%' || term || '%') * 20
        )
      END AS calculated_score,
      CASE WHEN cardinality(nt.terms) = 0 THEN true ELSE EXISTS (
        SELECT 1 FROM unnest(nt.terms) term
        WHERE lower(COALESCE(j.title, '')) LIKE '%' || term || '%'
           OR lower(COALESCE(array_to_string(j.skills, ' '), '')) LIKE '%' || term || '%'
      ) END AS has_title_or_skill_match
    FROM public.jobs j
    CROSS JOIN normalized_terms nt
    WHERE j.is_active = true
      AND j.status = 'active'
      AND (p_source IS NULL OR j.source = p_source)
      AND (p_location IS NULL OR lower(COALESCE(j.location, '')) LIKE '%' || lower(p_location) || '%')
      AND (p_job_type IS NULL OR lower(COALESCE(j.job_type, '')) LIKE '%' || lower(p_job_type) || '%')
      AND (p_work_mode IS NULL OR lower(COALESCE(j.work_mode, '') || ' ' || COALESCE(j.location, '')) LIKE '%' || lower(p_work_mode) || '%')
  ), filtered AS (
    SELECT * FROM scored
    WHERE NOT p_strict_match
       OR cardinality((SELECT terms FROM normalized_terms)) = 0
       OR (calculated_score >= 30 AND has_title_or_skill_match)
  )
  SELECT
    id, title, company, location, description, skills, job_type, work_mode,
    source, source_url, recruiter_id, posted_at, created_at,
    round(calculated_score, 0) AS match_score,
    count(*) OVER () AS total_count
  FROM filtered
  ORDER BY calculated_score DESC, posted_at DESC NULLS LAST, created_at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 30)
  OFFSET GREATEST(p_offset, 0);
$$;

GRANT EXECUTE ON FUNCTION public.search_collected_jobs(TEXT[], TEXT, TEXT, TEXT, TEXT, BOOLEAN, INTEGER, INTEGER) TO authenticated;
