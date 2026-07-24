
-- =========== PRESENCE ===========
CREATE TABLE public.presence (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'offline' CHECK (status IN ('online','studying','break','offline')),
  current_activity text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.presence TO authenticated;
GRANT ALL ON public.presence TO service_role;
ALTER TABLE public.presence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "presence self write" ON public.presence FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "presence partner read" ON public.presence FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_partner_of(auth.uid(), user_id));

-- =========== REACTIONS ===========
CREATE TABLE public.reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('cheer','keep_going','proud','congrats','high_five')),
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reactions_to_user_idx ON public.reactions (to_user, created_at DESC);
CREATE INDEX reactions_from_user_idx ON public.reactions (from_user, created_at DESC);
GRANT SELECT, INSERT ON public.reactions TO authenticated;
GRANT ALL ON public.reactions TO service_role;
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reactions insert self" ON public.reactions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = from_user AND public.is_partner_of(from_user, to_user));
CREATE POLICY "reactions read own" ON public.reactions FOR SELECT TO authenticated
  USING (auth.uid() = from_user OR auth.uid() = to_user);

CREATE OR REPLACE FUNCTION public.queue_reaction_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sender_name text;
  title text;
  body text;
BEGIN
  SELECT COALESCE(p.name, p.email, 'Your partner') INTO sender_name
    FROM public.profiles p WHERE p.id = NEW.from_user;
  body := COALESCE(NEW.context->>'note', '');
  title := CASE NEW.kind
    WHEN 'cheer' THEN sender_name || ' is cheering you on 🎉'
    WHEN 'keep_going' THEN sender_name || ' says keep going 💪'
    WHEN 'proud' THEN sender_name || ' is proud of you 🌟'
    WHEN 'congrats' THEN sender_name || ' says congrats! 🎊'
    WHEN 'high_five' THEN sender_name || ' sent you a high five ✋'
    ELSE sender_name || ' sent you some love 💛'
  END;
  IF body = '' THEN
    body := CASE NEW.kind
      WHEN 'cheer' THEN 'You got this — one more topic!'
      WHEN 'keep_going' THEN 'Momentum matters. Keep the streak alive.'
      WHEN 'proud' THEN 'Look at everything you''ve done today.'
      WHEN 'congrats' THEN 'Massive win. Take the moment.'
      WHEN 'high_five' THEN 'Right back at you 🙌'
      ELSE 'Sending good vibes your way.'
    END;
  END IF;
  INSERT INTO public.notification_queue (user_id, kind, title, body, url, data)
  VALUES (NEW.to_user, 'reaction', title, body, '/home',
    jsonb_build_object('from', NEW.from_user, 'reaction_kind', NEW.kind));
  RETURN NEW;
END $$;
CREATE TRIGGER trg_reactions_inserted AFTER INSERT ON public.reactions
FOR EACH ROW EXECUTE FUNCTION public.queue_reaction_notification();

-- =========== FOCUS SESSIONS ===========
CREATE TABLE public.focus_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  duration_min int NOT NULL CHECK (duration_min > 0 AND duration_min <= 240),
  started_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  state text NOT NULL DEFAULT 'studying' CHECK (state IN ('studying','break','ended')),
  joined_by_partner boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX focus_sessions_active_idx ON public.focus_sessions (state, ends_at DESC);
CREATE INDEX focus_sessions_host_idx ON public.focus_sessions (host_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.focus_sessions TO authenticated;
GRANT ALL ON public.focus_sessions TO service_role;
ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "focus read own or partner" ON public.focus_sessions FOR SELECT TO authenticated
  USING (auth.uid() = host_id OR auth.uid() = partner_id
         OR (partner_id IS NULL AND public.is_partner_of(auth.uid(), host_id)));
CREATE POLICY "focus insert host" ON public.focus_sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = host_id);
CREATE POLICY "focus update participant" ON public.focus_sessions FOR UPDATE TO authenticated
  USING (auth.uid() = host_id OR auth.uid() = partner_id);

CREATE TRIGGER trg_focus_sessions_updated BEFORE UPDATE ON public.focus_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.start_focus_session(p_duration_min int)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := auth.uid();
  partner uuid;
  sess_id uuid;
  sender_name text;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_duration_min IS NULL OR p_duration_min <= 0 OR p_duration_min > 240 THEN
    RAISE EXCEPTION 'invalid_duration';
  END IF;
  SELECT partner_id INTO partner FROM public.study_partners WHERE user_id = me LIMIT 1;
  IF partner IS NULL THEN
    SELECT user_id INTO partner FROM public.study_partners WHERE partner_id = me LIMIT 1;
  END IF;

  INSERT INTO public.focus_sessions (host_id, partner_id, duration_min, ends_at)
  VALUES (me, partner, p_duration_min, now() + make_interval(mins => p_duration_min))
  RETURNING id INTO sess_id;

  -- upsert presence to studying
  INSERT INTO public.presence (user_id, status, current_activity, updated_at)
  VALUES (me, 'studying', 'Focus session', now())
  ON CONFLICT (user_id) DO UPDATE SET status = 'studying', current_activity = 'Focus session', updated_at = now();

  IF partner IS NOT NULL THEN
    SELECT COALESCE(p.name, p.email, 'Your partner') INTO sender_name
      FROM public.profiles p WHERE p.id = me;
    INSERT INTO public.notification_queue (user_id, kind, title, body, url, data)
    VALUES (partner, 'focus_invite',
            sender_name || ' started a ' || p_duration_min || '-min focus session 🎯',
            'Tap to join and study together',
            '/home?focus=' || sess_id::text,
            jsonb_build_object('session_id', sess_id, 'from', me, 'duration_min', p_duration_min));
  END IF;
  RETURN sess_id;
END $$;

CREATE OR REPLACE FUNCTION public.join_focus_session(p_session_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); sess public.focus_sessions%ROWTYPE;
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
  END IF;
  INSERT INTO public.presence (user_id, status, current_activity, updated_at)
  VALUES (me, 'studying', 'Focus session', now())
  ON CONFLICT (user_id) DO UPDATE SET status = 'studying', current_activity = 'Focus session', updated_at = now();
END $$;

CREATE OR REPLACE FUNCTION public.end_focus_session(p_session_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); sess public.focus_sessions%ROWTYPE;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO sess FROM public.focus_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'session_not_found'; END IF;
  IF me <> sess.host_id AND me <> sess.partner_id THEN RAISE EXCEPTION 'not_participant'; END IF;
  UPDATE public.focus_sessions SET state = 'ended', ends_at = LEAST(ends_at, now()), updated_at = now()
   WHERE id = p_session_id;
  UPDATE public.presence SET status = 'online', current_activity = NULL, updated_at = now()
   WHERE user_id = me;
END $$;

CREATE OR REPLACE FUNCTION public.heartbeat_presence(p_status text, p_activity text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN RETURN; END IF;
  IF p_status IS NULL OR p_status NOT IN ('online','studying','break','offline') THEN
    p_status := 'online';
  END IF;
  INSERT INTO public.presence (user_id, status, current_activity, updated_at)
  VALUES (me, p_status, p_activity, now())
  ON CONFLICT (user_id) DO UPDATE SET status = EXCLUDED.status, current_activity = EXCLUDED.current_activity, updated_at = now();
END $$;

-- =========== DAILY CHECK-INS ===========
CREATE TABLE public.daily_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Kolkata')::date,
  morning_goal text,
  planned_topics text[] NOT NULL DEFAULT '{}',
  planned_minutes int,
  morning_at timestamptz,
  night_status text CHECK (night_status IS NULL OR night_status IN ('yes','partial','no')),
  night_note text,
  night_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);
CREATE INDEX daily_checkins_user_date_idx ON public.daily_checkins (user_id, date DESC);
GRANT SELECT, INSERT, UPDATE ON public.daily_checkins TO authenticated;
GRANT ALL ON public.daily_checkins TO service_role;
ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "checkin self write" ON public.daily_checkins FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "checkin partner read" ON public.daily_checkins FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_partner_of(auth.uid(), user_id));

CREATE TRIGGER trg_daily_checkins_updated BEFORE UPDATE ON public.daily_checkins
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.queue_checkin_partner_summary()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sender_name text;
  partner_id uuid;
  title text;
  body text;
BEGIN
  SELECT COALESCE(p.name, p.email, 'Your partner') INTO sender_name
    FROM public.profiles p WHERE p.id = NEW.user_id;

  -- morning submission
  IF (OLD IS NULL OR OLD.morning_at IS NULL) AND NEW.morning_at IS NOT NULL THEN
    title := sender_name || '''s plan for today ☀️';
    body := COALESCE(NEW.morning_goal, 'Set a goal for today') ||
            CASE WHEN NEW.planned_minutes IS NOT NULL
              THEN ' · ~' || NEW.planned_minutes || ' min' ELSE '' END;
    FOR partner_id IN
      SELECT sp.partner_id FROM public.study_partners sp WHERE sp.user_id = NEW.user_id
      UNION
      SELECT sp.user_id FROM public.study_partners sp WHERE sp.partner_id = NEW.user_id
    LOOP
      INSERT INTO public.notification_queue (user_id, kind, title, body, url, data)
      VALUES (partner_id, 'checkin_morning', title, body, '/home',
        jsonb_build_object('from', NEW.user_id, 'date', NEW.date));
    END LOOP;
  END IF;

  -- night submission
  IF (OLD IS NULL OR OLD.night_at IS NULL) AND NEW.night_at IS NOT NULL THEN
    title := sender_name ||
      CASE NEW.night_status
        WHEN 'yes' THEN ' hit today''s goal ✅'
        WHEN 'partial' THEN ' made good progress today 🌱'
        WHEN 'no' THEN ' wrapped up for today 🌙'
        ELSE ' checked in 🌙'
      END;
    body := COALESCE(NULLIF(NEW.night_note, ''), 'Tomorrow''s a fresh page.');
    FOR partner_id IN
      SELECT sp.partner_id FROM public.study_partners sp WHERE sp.user_id = NEW.user_id
      UNION
      SELECT sp.user_id FROM public.study_partners sp WHERE sp.partner_id = NEW.user_id
    LOOP
      INSERT INTO public.notification_queue (user_id, kind, title, body, url, data)
      VALUES (partner_id, 'checkin_night', title, body, '/home',
        jsonb_build_object('from', NEW.user_id, 'date', NEW.date, 'status', NEW.night_status));
    END LOOP;
  END IF;

  RETURN NEW;
END $$;
CREATE TRIGGER trg_daily_checkins_notify AFTER INSERT OR UPDATE ON public.daily_checkins
FOR EACH ROW EXECUTE FUNCTION public.queue_checkin_partner_summary();

-- =========== HELPER: fetch partner id for the current user ===========
CREATE OR REPLACE FUNCTION public.my_partner_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT partner_id FROM public.study_partners WHERE user_id = auth.uid() LIMIT 1),
    (SELECT user_id FROM public.study_partners WHERE partner_id = auth.uid() LIMIT 1)
  );
$$;

REVOKE EXECUTE ON FUNCTION public.queue_reaction_notification() FROM PUBLIC, authenticated;
REVOKE EXECUTE ON FUNCTION public.queue_checkin_partner_summary() FROM PUBLIC, authenticated;

GRANT EXECUTE ON FUNCTION public.start_focus_session(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_focus_session(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_focus_session(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.heartbeat_presence(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_partner_id() TO authenticated;

-- realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.presence;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.focus_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_checkins;
