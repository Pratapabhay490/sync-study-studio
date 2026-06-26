-- Resize quiz_chunks.embedding from 1536 (OpenAI) to 768 (Google text-embedding-004)
DROP INDEX IF EXISTS quiz_chunks_embedding_idx;
DELETE FROM public.quiz_chunks;
ALTER TABLE public.quiz_chunks ALTER COLUMN embedding TYPE vector(768) USING NULL;

CREATE INDEX IF NOT EXISTS quiz_chunks_embedding_idx
  ON public.quiz_chunks USING hnsw (embedding vector_cosine_ops);

CREATE OR REPLACE FUNCTION public.match_quiz_chunks(
  query_embedding vector(768),
  match_count int DEFAULT 6,
  p_document_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  similarity float
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT c.id, c.document_id, c.content,
         1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.quiz_chunks c
  WHERE c.user_id = auth.uid()
    AND (p_document_ids IS NULL OR c.document_id = ANY(p_document_ids))
    AND c.embedding IS NOT NULL
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count
$$;

-- Drop the old 1536-dim overload if it still exists
DROP FUNCTION IF EXISTS public.match_quiz_chunks(vector(1536), int, uuid[]);