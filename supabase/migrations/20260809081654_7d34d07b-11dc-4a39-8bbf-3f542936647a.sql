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

  INSERT INTO public.presence (user_id, status, current_activity, updated_at)
  VALUES (me, 'studying', 'Focus session', now())
  ON CONFLICT (user_id) DO UPDATE SET status = 'studying', current_activity = 'Focus session', updated_at = now();

  IF partner IS NOT NULL THEN
    SELECT COALESCE(
             NULLIF(btrim(p.name), ''),
             NULLIF(split_part(COALESCE(p.email, ''), '@', 1), ''),
             'Your partner')
      INTO sender_name
      FROM public.profiles p WHERE p.id = me;
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