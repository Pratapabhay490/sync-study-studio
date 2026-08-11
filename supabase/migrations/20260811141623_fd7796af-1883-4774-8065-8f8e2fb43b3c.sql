ALTER TABLE public.focus_sessions ADD COLUMN IF NOT EXISTS end_notified boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.join_focus_session(p_session_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE me uuid := auth.uid(); sess public.focus_sessions%ROWTYPE; joiner_name text;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO sess FROM public.focus_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'session_not_found'; END IF;
  IF sess.host_id = me THEN
    UPDATE public.focus_sessions SET joined_by_partner = joined_by_partner WHERE id = p_session_id;
  ELSIF NOT public.is_partner_of(sess.host_id, me) THEN
    RAISE EXCEPTION 'not_partner';
  ELSE
    UPDATE public.focus_sessions
       SET partner_id = me, joined_by_partner = true, updated_at = now()
     WHERE id = p_session_id;

    IF NOT COALESCE(sess.joined_by_partner, false) THEN
      SELECT COALESCE(
               NULLIF(btrim(p.name), ''),
               NULLIF(split_part(COALESCE(p.email, ''), '@', 1), ''),
               'Your partner')
        INTO joiner_name
        FROM public.profiles p WHERE p.id = me;
      joiner_name := COALESCE(NULLIF(btrim(joiner_name), ''), 'Your partner');

      INSERT INTO public.notification_queue (user_id, kind, title, body, url, data)
      VALUES (sess.host_id, 'focus_join',
              joiner_name || ' joined your focus session 🤝',
              'You are studying together now — keep it up!',
              '/home?focus=' || sess.id::text,
              jsonb_build_object('session_id', sess.id, 'from', me));
    END IF;
  END IF;

  INSERT INTO public.presence (user_id, status, current_activity, updated_at)
  VALUES (me, 'studying', 'Focus session', now())
  ON CONFLICT (user_id) DO UPDATE SET status = 'studying', current_activity = 'Focus session', updated_at = now();
END $function$;

CREATE OR REPLACE FUNCTION public.close_finished_focus_sessions()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r record; n integer := 0;
BEGIN
  FOR r IN
    SELECT * FROM public.focus_sessions
     WHERE ends_at <= now()
       AND COALESCE(end_notified, false) = false
       AND started_at > now() - interval '2 days'
  LOOP
    UPDATE public.focus_sessions
       SET state = 'ended', end_notified = true, updated_at = now()
     WHERE id = r.id;

    INSERT INTO public.notification_queue (user_id, kind, title, body, url, data)
    SELECT u, 'focus_end',
           'Focus session complete 🎉',
           r.duration_min || ' min done — stretch, hydrate and log what you covered.',
           '/home',
           jsonb_build_object('session_id', r.id, 'duration_min', r.duration_min)
      FROM (SELECT r.host_id AS u UNION SELECT r.partner_id) s
     WHERE u IS NOT NULL
       AND (u = r.host_id OR COALESCE(r.joined_by_partner, false));

    UPDATE public.presence SET status = 'online', current_activity = NULL, updated_at = now()
     WHERE user_id IN (r.host_id, r.partner_id) AND status = 'studying';

    n := n + 1;
  END LOOP;
  RETURN n;
END $function$;

REVOKE ALL ON FUNCTION public.close_finished_focus_sessions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.close_finished_focus_sessions() TO service_role;

SELECT cron.schedule('close-finished-focus-sessions', '* * * * *', $$SELECT public.close_finished_focus_sessions();$$);