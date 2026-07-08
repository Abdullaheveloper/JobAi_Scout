
CREATE OR REPLACE FUNCTION public.match_kb_chunks(
  query_embedding vector(1536),
  match_user_id uuid,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  content text,
  url text,
  title text,
  similarity float
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT c.id, c.content, c.url, c.title,
         1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.kb_chunks c
  WHERE c.user_id = match_user_id AND c.embedding IS NOT NULL
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;

REVOKE EXECUTE ON FUNCTION public.match_kb_chunks(vector, uuid, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.match_kb_chunks(vector, uuid, int) TO authenticated, service_role;
