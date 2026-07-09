-- Migration: Hybrid search infrastructure + enhanced metadata
-- Phase 1 & 2 of Production-Ready AI Voice Assistant

-- 1. Enhanced metadata columns on kb_chunks
ALTER TABLE public.kb_chunks ADD COLUMN IF NOT EXISTS page_number int DEFAULT 1;
ALTER TABLE public.kb_chunks ADD COLUMN IF NOT EXISTS section_heading text;
ALTER TABLE public.kb_chunks ADD COLUMN IF NOT EXISTS chunk_index int DEFAULT 0;
ALTER TABLE public.kb_chunks ADD COLUMN IF NOT EXISTS document_type text DEFAULT 'url';

-- 2. Enhanced metadata on kb_sources
ALTER TABLE public.kb_sources ADD COLUMN IF NOT EXISTS file_size bigint;
ALTER TABLE public.kb_sources ADD COLUMN IF NOT EXISTS mime_type text;
ALTER TABLE public.kb_sources ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';
ALTER TABLE public.kb_sources ADD COLUMN IF NOT EXISTS document_type text DEFAULT 'url';

-- 3. Add tsvector column for full-text keyword search
ALTER TABLE public.kb_chunks ADD COLUMN IF NOT EXISTS fts tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(content, ''))) STORED;

-- 4. Index for FTS
CREATE INDEX IF NOT EXISTS kb_chunks_fts_idx ON public.kb_chunks USING gin(fts);

-- 5. Hybrid search function: Reciprocal Rank Fusion (RRF) of vector + keyword search
CREATE OR REPLACE FUNCTION hybrid_search_kb(
  query_text text,
  query_embedding vector,
  match_user_id uuid,
  match_count int DEFAULT 10,
  rrf_k int DEFAULT 60
) RETURNS TABLE (
  id uuid,
  content text,
  url text,
  title text,
  source_id uuid,
  page_number int,
  section_heading text,
  chunk_index int,
  document_type text,
  semantic_rank bigint,
  keyword_rank bigint,
  rrf_score double precision,
  similarity double precision
) LANGUAGE sql STABLE AS $$
  WITH semantic AS (
    SELECT
      c.id,
      ROW_NUMBER() OVER (ORDER BY c.embedding <=> query_embedding) AS rank,
      1.0 - (c.embedding <=> query_embedding) AS similarity
    FROM public.kb_chunks c
    WHERE c.user_id = match_user_id AND c.embedding IS NOT NULL
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count * 3
  ),
  keyword AS (
    SELECT
      c.id,
      ROW_NUMBER() OVER (ORDER BY ts_rank_cd(c.fts, websearch_to_tsquery('english', query_text)) DESC) AS rank
    FROM public.kb_chunks c
    WHERE
      c.user_id = match_user_id
      AND c.fts @@ websearch_to_tsquery('english', query_text)
    ORDER BY ts_rank_cd(c.fts, websearch_to_tsquery('english', query_text)) DESC
    LIMIT match_count * 3
  ),
  combined AS (
    SELECT
      COALESCE(s.id, k.id) AS id,
      COALESCE(s.rank, (match_count * 3)::bigint) AS semantic_rank,
      COALESCE(k.rank, (match_count * 3)::bigint) AS keyword_rank,
      COALESCE(s.similarity, 0.0) AS similarity,
      (1.0 / (rrf_k + COALESCE(s.rank, (match_count * 3)::bigint))::double precision) +
      (1.0 / (rrf_k + COALESCE(k.rank, (match_count * 3)::bigint))::double precision) AS rrf_score
    FROM semantic s
    FULL OUTER JOIN keyword k ON s.id = k.id
  )
  SELECT
    c.id,
    c.content,
    c.url,
    c.title,
    c.source_id,
    COALESCE(c.page_number, 1) AS page_number,
    c.section_heading,
    COALESCE(c.chunk_index, 0) AS chunk_index,
    COALESCE(c.document_type, 'url') AS document_type,
    comb.semantic_rank,
    comb.keyword_rank,
    comb.rrf_score,
    comb.similarity
  FROM combined comb
  JOIN public.kb_chunks c ON c.id = comb.id
  ORDER BY comb.rrf_score DESC
  LIMIT match_count;
$$;

-- 6. Grant execute on function
GRANT EXECUTE ON FUNCTION hybrid_search_kb TO authenticated;
GRANT EXECUTE ON FUNCTION hybrid_search_kb TO service_role;

-- 7. Backfill document_type for existing PDF sources (url vs pdf heuristic)
UPDATE public.kb_chunks
SET document_type = 'pdf'
WHERE url LIKE 'pdf://%' AND document_type = 'url';

UPDATE public.kb_sources
SET document_type = 'pdf'
WHERE url LIKE 'pdf://%' AND (document_type IS NULL OR document_type = 'url');
