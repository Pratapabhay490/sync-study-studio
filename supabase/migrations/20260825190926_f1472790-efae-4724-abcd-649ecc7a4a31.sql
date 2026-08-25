
CREATE TABLE IF NOT EXISTS public.focus_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.focus_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz
);

GRANT SELECT, INSERT, UPDATE ON public.focus_participants TO authenticated;
GRANT ALL ON public.focus_participants TO service_role;
ALTER TABLE public.focus_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "focus_participants_select" ON public.focus_participants;
CREATE POLICY "focus_participants_select" ON public.focus_participants
FOR SELECT TO authenticated
USING (user_id = (select auth.uid()) OR public.is_partner_of(user_id, (select auth.uid())));

CREATE INDEX IF NOT EXISTS idx_focus_participants_session ON public.focus_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_focus_participants_user_joined ON public.focus_participants(user_id, joined_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.focus_participants;

-- backfill from existing sessions
INSERT INTO public.focus_participants (session_id, user_id, joined_at, left_at)
SELECT f.id, f.host_id, f.started_at,
       CASE WHEN f.state = 'ended' THEN LEAST(f.ends_at, f.updated_at) ELSE NULL END
FROM public.focus_sessions f
WHERE NOT EXISTS (SELECT 1 FROM public.focus_participants p WHERE p.session_id = f.id AND p.user_id = f.host_id);

INSERT INTO public.focus_participants (session_id, user_id, joined_at, left_at)
SELECT f.id, f.partner_id, f.started_at,
       CASE WHEN f.state = 'ended' THEN LEAST(f.ends_at, f.updated_at) ELSE NULL END
FROM public.focus_sessions f
WHERE f.partner_id IS NOT NULL AND COALESCE(f.joined_by_partner,false)
  AND NOT EXISTS (SELECT 1 FROM public.focus_participants p WHERE p.session_id = f.id AND p.user_id = f.partner_id);

-- start: record host as participant
CREATE OR REPLACE FUNCTION public.start_focus_session(p_duration_min integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  me uuid := auth.uid();
  partner uuid;
  sess_id uuid;
  sender_name text;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_duration_min IS NULL OR p_duration_min <= 0 OR p_duration_min > 480 THEN
    RAISE EXCEPTION 'invalid_duration';
  END IF;
  SELECT partner_id INTO partner FROM public.study_partners WHERE user_id = me LIMIT 1;
  IF partner IS NULL THEN
    SELECT user_id INTO partner FROM public.study_partners WHERE partner_id = me LIMIT 1;
  END IF;

  INSERT INTO public.focus_sessions (host_id, partner_id, duration_min, ends_at)
  VALUES (me, partner, p_duration_min, now() + make_interval(mins => p_duration_min))
  RETURNING id INTO sess_id;

  INSERT INTO public.focus_participants (session_id, user_id, joined_at)
  VALUES (sess_id, me, now());

  INSERT INTO public.presence (user_id, status, current_activity, updated_at)
  VALUES (me, 'studying', 'Focus session', now())
  ON CONFLICT (user_id) DO UPDATE SET status = 'studying', current_activity = 'Focus session', updated_at = now();

  IF partner IS NOT NULL THEN
    SELECT COALESCE(NULLIF(btrim(p.name), ''), NULLIF(split_part(COALESCE(p.email, ''), '@', 1), ''), 'Your partner')
      INTO sender_name FROM public.profiles p WHERE p.id = me;
    sender_name := COALESCE(NULLIF(btrim(sender_name), ''), 'Your partner');

    INSERT INTO public.notification_queue (user_id, kind, title, body, url, data)
    VALUES (partner, 'focus_invite',
            sender_name || ' started a ' || p_duration_min || '-min focus session 🎯',
            'Tap to join and study together',
            '/home?focus=' || sess_id::text,
            jsonb_build_object('session_id', sess_id, 'from', me, 'duration_min', p_duration_min));
  END IF;
  RETURN sess_id;
END $function$;

-- join: open a participation interval
CREATE OR REPLACE FUNCTION public.join_focus_session(p_session_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE me uuid := auth.uid(); sess public.focus_sessions%ROWTYPE; joiner_name text; already boolean;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO sess FROM public.focus_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'session_not_found'; END IF;
  IF sess.state = 'ended' THEN RAISE EXCEPTION 'session_ended'; END IF;

  IF sess.host_id <> me AND NOT public.is_partner_of(sess.host_id, me) THEN
    RAISE EXCEPTION 'not_partner';
  END IF;

  IF sess.host_id <> me THEN
    UPDATE public.focus_sessions
       SET partner_id = me, joined_by_partner = true, updated_at = now()
     WHERE id = p_session_id;
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.focus_participants
                  WHERE session_id = p_session_id AND user_id = me AND left_at IS NULL)
    INTO already;

  IF NOT already THEN
    INSERT INTO public.focus_participants (session_id, user_id, joined_at)
    VALUES (p_session_id, me, now());

    IF sess.host_id <> me THEN
      SELECT COALESCE(NULLIF(btrim(p.name), ''), NULLIF(split_part(COALESCE(p.email, ''), '@', 1), ''), 'Your partner')
        INTO joiner_name FROM public.profiles p WHERE p.id = me;
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

-- leave: close my interval, notify the others, session keeps running
CREATE OR REPLACE FUNCTION public.leave_focus_session(p_session_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE me uuid := auth.uid(); sess public.focus_sessions%ROWTYPE; leaver_name text; mins int; remaining int;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO sess FROM public.focus_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'session_not_found'; END IF;
  IF me <> sess.host_id AND me <> sess.partner_id THEN RAISE EXCEPTION 'not_participant'; END IF;

  UPDATE public.focus_participants
     SET left_at = now()
   WHERE session_id = p_session_id AND user_id = me AND left_at IS NULL;

  UPDATE public.presence SET status = 'online', current_activity = NULL, updated_at = now()
   WHERE user_id = me;

  SELECT COALESCE(NULLIF(btrim(p.name), ''), NULLIF(split_part(COALESCE(p.email, ''), '@', 1), ''), 'Your partner')
    INTO leaver_name FROM public.profiles p WHERE p.id = me;
  leaver_name := COALESCE(NULLIF(btrim(leaver_name), ''), 'Your partner');

  SELECT GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (now() - sess.started_at)) / 60))::int INTO mins;

  INSERT INTO public.notification_queue (user_id, kind, title, body, url, data)
  SELECT fp.user_id, 'focus_leave',
         leaver_name || ' left the focus session 👋',
         'They studied ' || mins || ' min. You are still on the clock — keep going!',
         '/home?focus=' || sess.id::text,
         jsonb_build_object('session_id', sess.id, 'from', me, 'minutes', mins)
    FROM public.focus_participants fp
   WHERE fp.session_id = p_session_id AND fp.user_id <> me AND fp.left_at IS NULL;

  SELECT count(*) INTO remaining FROM public.focus_participants
   WHERE session_id = p_session_id AND left_at IS NULL;

  IF remaining = 0 THEN
    UPDATE public.focus_sessions
       SET state = 'ended', ends_at = LEAST(ends_at, now()), end_notified = true, updated_at = now()
     WHERE id = p_session_id AND state <> 'ended';
  END IF;
END $function$;

-- end: close everyone
CREATE OR REPLACE FUNCTION public.end_focus_session(p_session_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE me uuid := auth.uid(); sess public.focus_sessions%ROWTYPE;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO sess FROM public.focus_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'session_not_found'; END IF;
  IF me <> sess.host_id AND me <> sess.partner_id THEN RAISE EXCEPTION 'not_participant'; END IF;

  UPDATE public.focus_participants SET left_at = now()
   WHERE session_id = p_session_id AND left_at IS NULL;

  UPDATE public.focus_sessions SET state = 'ended', ends_at = LEAST(ends_at, now()), updated_at = now()
   WHERE id = p_session_id;

  UPDATE public.presence SET status = 'online', current_activity = NULL, updated_at = now()
   WHERE user_id IN (sess.host_id, sess.partner_id) AND status = 'studying';
END $function$;

-- cron close: also close open intervals at the planned end
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
    UPDATE public.focus_participants
       SET left_at = LEAST(r.ends_at, now())
     WHERE session_id = r.id AND left_at IS NULL;

    UPDATE public.focus_sessions
       SET state = 'ended', end_notified = true, updated_at = now()
     WHERE id = r.id;

    INSERT INTO public.notification_queue (user_id, kind, title, body, url, data)
    SELECT DISTINCT fp.user_id, 'focus_end',
           'Focus session complete 🎉',
           r.duration_min || ' min done — stretch, hydrate and log what you covered.',
           '/home',
           jsonb_build_object('session_id', r.id, 'duration_min', r.duration_min)
      FROM public.focus_participants fp WHERE fp.session_id = r.id;

    UPDATE public.presence SET status = 'online', current_activity = NULL, updated_at = now()
     WHERE user_id IN (r.host_id, r.partner_id) AND status = 'studying';

    n := n + 1;
  END LOOP;
  RETURN n;
END $function$;

-- XP per participant based on their own presence time
CREATE OR REPLACE FUNCTION public.gamify_focus_end()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE p record; actual_min int; xp_amount int;
BEGIN
  IF NEW.state = 'ended' AND (OLD IS NULL OR OLD.state <> 'ended') THEN
    FOR p IN
      SELECT user_id,
             GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (
               LEAST(COALESCE(left_at, now()), NEW.ends_at, now()) - GREATEST(joined_at, NEW.started_at)
             )) / 60))::int AS mins
        FROM public.focus_participants
       WHERE session_id = NEW.id
    LOOP
      actual_min := LEAST(NEW.duration_min, p.mins);
      IF actual_min >= 5 THEN
        xp_amount := LEAST(200, GREATEST(10, actual_min * 2));
        PERFORM public.award_xp(p.user_id, 'focus_session', xp_amount, NEW.id, 'focus',
          jsonb_build_object('minutes', actual_min));
        PERFORM public.unlock_badge(p.user_id, 'first_focus');
        IF actual_min >= 90 THEN PERFORM public.unlock_badge(p.user_id, 'focus_marathon'); END IF;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END $function$;

REVOKE ALL ON FUNCTION public.leave_focus_session(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leave_focus_session(uuid) TO authenticated;
