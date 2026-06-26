
-- pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- =========================
-- 1. Documents (uploads for RAG)
-- =========================
CREATE TABLE public.quiz_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  source_type text NOT NULL DEFAULT 'text', -- text|pdf|md|txt|paste
  subject text,
  topic text,
  char_count integer NOT NULL DEFAULT 0,
  chunk_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ready', -- pending|embedding|ready|error
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_documents TO authenticated;
GRANT ALL ON public.quiz_documents TO service_role;
ALTER TABLE public.quiz_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "doc owner read"   ON public.quiz_documents FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "doc owner write"  ON public.quiz_documents FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "doc owner update" ON public.quiz_documents FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "doc owner delete" ON public.quiz_documents FOR DELETE TO authenticated USING (user_id = auth.uid());

-- =========================
-- 2. Document chunks + embeddings
-- =========================
CREATE TABLE public.quiz_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.quiz_documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  embedding vector(1536), -- openai/text-embedding-3-small
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_chunks TO authenticated;
GRANT ALL ON public.quiz_chunks TO service_role;
ALTER TABLE public.quiz_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chunk owner read"  ON public.quiz_chunks FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "chunk owner write" ON public.quiz_chunks FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "chunk owner delete"ON public.quiz_chunks FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS quiz_chunks_embedding_idx
  ON public.quiz_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS quiz_chunks_doc_idx ON public.quiz_chunks (document_id);

-- Similarity search RPC (per-user)
CREATE OR REPLACE FUNCTION public.match_quiz_chunks(
  query_embedding vector(1536),
  match_count int DEFAULT 6,
  p_document_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (id uuid, document_id uuid, content text, similarity float)
LANGUAGE sql STABLE SECURITY INVOKER
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

-- =========================
-- 3. AI-generated question bank (shared)
-- =========================
CREATE TABLE public.quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  subject text,
  topic text,
  difficulty text NOT NULL DEFAULT 'medium', -- easy|medium|hard|neetpg|inicet
  source text NOT NULL DEFAULT 'ai', -- ai|rag|pyq
  source_doc_id uuid REFERENCES public.quiz_documents(id) ON DELETE SET NULL,
  stem text NOT NULL,
  options jsonb NOT NULL, -- ["A...","B...","C...","D..."]
  correct_index integer NOT NULL CHECK (correct_index BETWEEN 0 AND 3),
  explanation text,
  pearls text,
  tags text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_questions TO authenticated;
GRANT ALL ON public.quiz_questions TO service_role;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "q read all auth" ON public.quiz_questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "q insert auth"   ON public.quiz_questions FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "q update owner"  ON public.quiz_questions FOR UPDATE TO authenticated USING (created_by = auth.uid());
CREATE POLICY "q delete owner"  ON public.quiz_questions FOR DELETE TO authenticated USING (created_by = auth.uid());
CREATE INDEX IF NOT EXISTS quiz_questions_subject_idx ON public.quiz_questions(subject, topic, difficulty);

-- =========================
-- 4. Quiz sessions + players
-- =========================
CREATE TABLE public.quiz_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, -- nullable for solo
  mode text NOT NULL DEFAULT 'duo', -- solo|duo
  subject text,
  topic text,
  difficulty text NOT NULL DEFAULT 'medium',
  source text NOT NULL DEFAULT 'ai', -- ai|rag
  document_ids uuid[] DEFAULT '{}',
  question_count integer NOT NULL DEFAULT 10,
  seconds_per_question integer NOT NULL DEFAULT 60,
  status text NOT NULL DEFAULT 'lobby', -- lobby|active|finished|cancelled
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_sessions TO authenticated;
GRANT ALL ON public.quiz_sessions TO service_role;
ALTER TABLE public.quiz_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "session participants read" ON public.quiz_sessions FOR SELECT TO authenticated
  USING (host_id = auth.uid() OR partner_id = auth.uid());
CREATE POLICY "session host insert"       ON public.quiz_sessions FOR INSERT TO authenticated
  WITH CHECK (host_id = auth.uid());
CREATE POLICY "session host update"       ON public.quiz_sessions FOR UPDATE TO authenticated
  USING (host_id = auth.uid() OR partner_id = auth.uid());
CREATE POLICY "session host delete"       ON public.quiz_sessions FOR DELETE TO authenticated
  USING (host_id = auth.uid());

CREATE TABLE public.quiz_session_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.quiz_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'joined', -- joined|thinking|answered|finished
  current_index integer NOT NULL DEFAULT 0,
  score integer NOT NULL DEFAULT 0,
  correct_count integer NOT NULL DEFAULT 0,
  attempted_count integer NOT NULL DEFAULT 0,
  finished_at timestamptz,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_session_players TO authenticated;
GRANT ALL ON public.quiz_session_players TO service_role;
ALTER TABLE public.quiz_session_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "players read partic" ON public.quiz_session_players FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quiz_sessions s
                 WHERE s.id = session_id AND (s.host_id = auth.uid() OR s.partner_id = auth.uid())));
CREATE POLICY "players insert self" ON public.quiz_session_players FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "players update self" ON public.quiz_session_players FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Locked question order
CREATE TABLE public.quiz_session_questions (
  session_id uuid NOT NULL REFERENCES public.quiz_sessions(id) ON DELETE CASCADE,
  position integer NOT NULL,
  question_id uuid NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  PRIMARY KEY (session_id, position)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_session_questions TO authenticated;
GRANT ALL ON public.quiz_session_questions TO service_role;
ALTER TABLE public.quiz_session_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sq read partic" ON public.quiz_session_questions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quiz_sessions s
                 WHERE s.id = session_id AND (s.host_id = auth.uid() OR s.partner_id = auth.uid())));
CREATE POLICY "sq host write"  ON public.quiz_session_questions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.quiz_sessions s WHERE s.id = session_id AND s.host_id = auth.uid()));

-- Individual answers
CREATE TABLE public.quiz_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.quiz_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  position integer NOT NULL,
  selected_index integer, -- null = skipped/timed out
  is_correct boolean NOT NULL DEFAULT false,
  ms_taken integer,
  answered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, user_id, position)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_answers TO authenticated;
GRANT ALL ON public.quiz_answers TO service_role;
ALTER TABLE public.quiz_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ans read partic" ON public.quiz_answers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quiz_sessions s
                 WHERE s.id = session_id AND (s.host_id = auth.uid() OR s.partner_id = auth.uid())));
CREATE POLICY "ans insert self" ON public.quiz_answers FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- =========================
-- 5. Bookmarks + Wrong-question bank (spaced repetition)
-- =========================
CREATE TABLE public.quiz_bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, question_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_bookmarks TO authenticated;
GRANT ALL ON public.quiz_bookmarks TO service_role;
ALTER TABLE public.quiz_bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bm owner all" ON public.quiz_bookmarks FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.quiz_wrong_bank (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  wrong_count integer NOT NULL DEFAULT 1,
  last_wrong_at timestamptz NOT NULL DEFAULT now(),
  next_review_at timestamptz NOT NULL DEFAULT (now() + interval '1 day'),
  interval_stage integer NOT NULL DEFAULT 0, -- 0:1d 1:3d 2:7d 3:15d 4:30d
  resolved boolean NOT NULL DEFAULT false,
  UNIQUE (user_id, question_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_wrong_bank TO authenticated;
GRANT ALL ON public.quiz_wrong_bank TO service_role;
ALTER TABLE public.quiz_wrong_bank ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wb owner all" ON public.quiz_wrong_bank FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- updated_at triggers (reusing existing public.update_updated_at_column())
CREATE TRIGGER trg_quiz_documents_updated BEFORE UPDATE ON public.quiz_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_quiz_sessions_updated BEFORE UPDATE ON public.quiz_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_session_players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_answers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_session_questions;

-- =========================
-- 6. RPC: start a session atomically (lock question order, add players)
-- =========================
CREATE OR REPLACE FUNCTION public.start_quiz_session(
  p_session_id uuid,
  p_question_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  sess public.quiz_sessions%ROWTYPE;
  i int;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO sess FROM public.quiz_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'session_not_found'; END IF;
  IF sess.host_id <> me THEN RAISE EXCEPTION 'not_host'; END IF;

  DELETE FROM public.quiz_session_questions WHERE session_id = p_session_id;
  FOR i IN 1..array_length(p_question_ids, 1) LOOP
    INSERT INTO public.quiz_session_questions(session_id, position, question_id)
    VALUES (p_session_id, i - 1, p_question_ids[i]);
  END LOOP;

  -- ensure host player row
  INSERT INTO public.quiz_session_players(session_id, user_id)
  VALUES (p_session_id, sess.host_id) ON CONFLICT DO NOTHING;
  -- partner row (if any) is created when they join

  UPDATE public.quiz_sessions
     SET status = 'active', started_at = now()
   WHERE id = p_session_id;
END;
$$;
REVOKE ALL ON FUNCTION public.start_quiz_session(uuid, uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.start_quiz_session(uuid, uuid[]) TO authenticated;

-- RPC: join as partner
CREATE OR REPLACE FUNCTION public.join_quiz_session(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE me uuid := auth.uid(); sess public.quiz_sessions%ROWTYPE;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO sess FROM public.quiz_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'session_not_found'; END IF;
  IF sess.host_id = me THEN RETURN; END IF;
  IF sess.partner_id IS NULL THEN
    UPDATE public.quiz_sessions SET partner_id = me WHERE id = p_session_id;
  ELSIF sess.partner_id <> me THEN
    RAISE EXCEPTION 'session_full';
  END IF;
  INSERT INTO public.quiz_session_players(session_id, user_id)
  VALUES (p_session_id, me) ON CONFLICT DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION public.join_quiz_session(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.join_quiz_session(uuid) TO authenticated;

-- RPC: record an answer and update player aggregates + wrong bank
CREATE OR REPLACE FUNCTION public.submit_quiz_answer(
  p_session_id uuid,
  p_position int,
  p_question_id uuid,
  p_selected_index int,
  p_ms_taken int
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  correct_idx int;
  is_corr boolean;
  next_iv interval;
  stage int;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT correct_index INTO correct_idx FROM public.quiz_questions WHERE id = p_question_id;
  IF correct_idx IS NULL THEN RAISE EXCEPTION 'q_not_found'; END IF;
  is_corr := (p_selected_index IS NOT NULL AND p_selected_index = correct_idx);

  INSERT INTO public.quiz_answers(session_id, user_id, question_id, position, selected_index, is_correct, ms_taken)
  VALUES (p_session_id, me, p_question_id, p_position, p_selected_index, is_corr, p_ms_taken)
  ON CONFLICT (session_id, user_id, position) DO NOTHING;

  UPDATE public.quiz_session_players
     SET attempted_count = attempted_count + 1,
         correct_count   = correct_count + CASE WHEN is_corr THEN 1 ELSE 0 END,
         score           = score + CASE WHEN is_corr THEN 10 ELSE 0 END,
         current_index   = GREATEST(current_index, p_position + 1),
         status          = 'answered'
   WHERE session_id = p_session_id AND user_id = me;

  IF NOT is_corr THEN
    INSERT INTO public.quiz_wrong_bank(user_id, question_id)
    VALUES (me, p_question_id)
    ON CONFLICT (user_id, question_id) DO UPDATE
      SET wrong_count = quiz_wrong_bank.wrong_count + 1,
          last_wrong_at = now(),
          interval_stage = LEAST(quiz_wrong_bank.interval_stage + 1, 4),
          next_review_at = now() + (ARRAY[interval '1 day', interval '3 days', interval '7 days', interval '15 days', interval '30 days'])[LEAST(quiz_wrong_bank.interval_stage + 1, 4) + 1],
          resolved = false;
  ELSE
    UPDATE public.quiz_wrong_bank SET resolved = true
     WHERE user_id = me AND question_id = p_question_id;
  END IF;

  RETURN is_corr;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_quiz_answer(uuid,int,uuid,int,int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.submit_quiz_answer(uuid,int,uuid,int,int) TO authenticated;
