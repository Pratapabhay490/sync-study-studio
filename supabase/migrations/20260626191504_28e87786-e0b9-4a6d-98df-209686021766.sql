CREATE OR REPLACE FUNCTION public.start_review_session(p_limit integer DEFAULT 10)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  me uuid := auth.uid();
  sess_id uuid;
  q_ids uuid[];
  i int;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT array_agg(question_id) INTO q_ids FROM (
    SELECT question_id FROM public.quiz_wrong_bank
    WHERE user_id = me AND resolved = false
    ORDER BY (next_review_at <= now()) DESC, next_review_at ASC, wrong_count DESC
    LIMIT GREATEST(p_limit, 1)
  ) q;

  IF q_ids IS NULL OR array_length(q_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'no_review_questions';
  END IF;

  INSERT INTO public.quiz_sessions(host_id, mode, subject, topic, difficulty, source, question_count, seconds_per_question, status, started_at)
  VALUES (me, 'solo', 'Review', 'Spaced repetition', 'mixed', 'review', array_length(q_ids, 1), 60, 'active', now())
  RETURNING id INTO sess_id;

  INSERT INTO public.quiz_session_players(session_id, user_id) VALUES (sess_id, me);

  FOR i IN 1..array_length(q_ids, 1) LOOP
    INSERT INTO public.quiz_session_questions(session_id, position, question_id)
    VALUES (sess_id, i - 1, q_ids[i]);
  END LOOP;

  RETURN sess_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.start_review_session(integer) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.start_review_session(integer) TO authenticated;