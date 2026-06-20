
CREATE EXTENSION IF NOT EXISTS vector;

-- Knowledge base sources (websites/URLs to crawl)
CREATE TABLE public.kb_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url text NOT NULL,
  title text,
  status text NOT NULL DEFAULT 'pending',
  pages_indexed int NOT NULL DEFAULT 0,
  error text,
  last_crawled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_sources TO authenticated;
GRANT ALL ON public.kb_sources TO service_role;
ALTER TABLE public.kb_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own kb sources" ON public.kb_sources
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER kb_sources_updated_at BEFORE UPDATE ON public.kb_sources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Chunks with embeddings
CREATE TABLE public.kb_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES public.kb_sources(id) ON DELETE CASCADE,
  url text NOT NULL,
  title text,
  content text NOT NULL,
  chunk_index int NOT NULL DEFAULT 0,
  embedding vector(1536),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_chunks TO authenticated;
GRANT ALL ON public.kb_chunks TO service_role;
ALTER TABLE public.kb_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own kb chunks" ON public.kb_chunks
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX kb_chunks_source_idx ON public.kb_chunks(source_id);
CREATE INDEX kb_chunks_user_idx ON public.kb_chunks(user_id);
CREATE INDEX kb_chunks_embedding_idx ON public.kb_chunks
  USING hnsw (embedding vector_cosine_ops);

-- Match function
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
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.id, c.content, c.url, c.title,
         1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.kb_chunks c
  WHERE c.user_id = match_user_id AND c.embedding IS NOT NULL
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Conversations
CREATE TABLE public.voice_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_conversations TO authenticated;
GRANT ALL ON public.voice_conversations TO service_role;
ALTER TABLE public.voice_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own voice convos" ON public.voice_conversations
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER voice_conversations_updated_at BEFORE UPDATE ON public.voice_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Messages
CREATE TABLE public.voice_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.voice_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_messages TO authenticated;
GRANT ALL ON public.voice_messages TO service_role;
ALTER TABLE public.voice_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own voice messages" ON public.voice_messages
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX voice_messages_convo_idx ON public.voice_messages(conversation_id, created_at);
