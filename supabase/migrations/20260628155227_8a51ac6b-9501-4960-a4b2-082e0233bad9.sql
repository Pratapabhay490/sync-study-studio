
CREATE OR REPLACE FUNCTION public.enqueue_quiz_invite(
  p_session_id uuid,
  p_title text,
  p_body text,
  p_url text
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  inserted int := 0;
  partner_id uuid;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  FOR partner_id IN
    SELECT sp.partner_id FROM public.study_partners sp WHERE sp.user_id = me
    UNION
    SELECT sp.user_id FROM public.study_partners sp WHERE sp.partner_id = me
  LOOP
    IF partner_id = me THEN CONTINUE; END IF;
    INSERT INTO public.notification_queue(user_id, kind, title, body, url, data)
    VALUES (partner_id, 'quiz_invite', p_title, p_body, p_url,
            jsonb_build_object('session_id', p_session_id, 'from', me));
    inserted := inserted + 1;
  END LOOP;
  RETURN inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_quiz_invite(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enqueue_quiz_invite(uuid, text, text, text) TO authenticated;
