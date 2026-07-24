
-- =========================
-- XP EVENTS
-- =========================
CREATE TABLE public.user_xp_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  amount int NOT NULL,
  ref_id uuid,
  ref_type text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_user_xp_events_user ON public.user_xp_events(user_id, created_at DESC);
CREATE UNIQUE INDEX uq_user_xp_events_dedup
  ON public.user_xp_events(user_id, kind, ref_id)
  WHERE ref_id IS NOT NULL;

GRANT SELECT ON public.user_xp_events TO authenticated;
GRANT ALL ON public.user_xp_events TO service_role;
ALTER TABLE public.user_xp_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read own + partner xp events"
  ON public.user_xp_events FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_partner_of(auth.uid(), user_id));

-- =========================
-- BADGES CATALOG
-- =========================
CREATE TABLE public.badges (
  key text PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL,
  emoji text NOT NULL,
  tier text NOT NULL DEFAULT 'bronze',
  xp_reward int NOT NULL DEFAULT 25,
  sort_order int NOT NULL DEFAULT 0
);
GRANT SELECT ON public.badges TO authenticated, anon;
GRANT ALL ON public.badges TO service_role;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "badges catalog is public" ON public.badges FOR SELECT USING (true);

INSERT INTO public.badges(key, title, description, emoji, tier, xp_reward, sort_order) VALUES
  ('first_topic',      'First Steps',        'Complete your very first topic',              '🌱', 'bronze', 25, 1),
  ('topics_10',        'Warming Up',         'Complete 10 topics',                          '🔥', 'bronze', 50, 2),
  ('topics_50',        'Half Century',       'Complete 50 topics',                          '⚡', 'silver', 100, 3),
  ('topics_100',       'Century Club',       'Complete 100 topics',                         '💯', 'gold',   200, 4),
  ('first_subject',    'Subject Slayer',     'Finish your first subject 100%',              '🏆', 'silver', 100, 5),
  ('subjects_5',       'Systems Master',     'Finish 5 subjects',                           '👑', 'gold',   300, 6),
  ('first_quiz',       'Quiz Rookie',        'Attempt your first quiz',                     '🎯', 'bronze', 25, 10),
  ('sharpshooter',     'Sharpshooter',       'Score 90%+ on a quiz',                        '🏹', 'silver', 100, 11),
  ('perfectionist',    'Perfectionist',      'Score 100% on a quiz',                        '💎', 'gold',   200, 12),
  ('mcq_100',          'Century of MCQs',    'Answer 100 questions',                        '📚', 'silver',  75, 13),
  ('mcq_500',          'MCQ Marathoner',     'Answer 500 questions',                        '🎓', 'gold',   250, 14),
  ('first_focus',      'Locked In',          'Complete your first focus session',           '🎧', 'bronze', 25, 20),
  ('focus_marathon',   'Focus Marathon',     'Complete a 90-minute focus session',          '🧠', 'gold',   150, 21),
  ('early_bird',       'Early Bird',         'Morning check-in before 7 AM, 5 times',       '🌅', 'silver', 75, 30),
  ('night_owl',        'Night Owl',          'Study after 11 PM, 5 times',                  '🦉', 'silver', 75, 31),
  ('motivator',        'Motivator',          'Send 10 reactions to your partner',           '💛', 'bronze', 50, 40),
  ('first_partner',    'Better Together',    'Add your first study partner',                '🤝', 'silver', 100, 50),
  ('together_7',       'Week in Sync',       '7-day together streak',                       '🔥', 'silver', 150, 51),
  ('together_30',      'Month in Sync',      '30-day together streak',                      '🌟', 'gold',   500, 52),
  ('sync_duo',         'Sync Duo',           'Both hit night goal same day, 5 times',       '💫', 'gold',   200, 53)
ON CONFLICT (key) DO NOTHING;

-- =========================
-- USER BADGES
-- =========================
CREATE TABLE public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_key text NOT NULL REFERENCES public.badges(key) ON DELETE CASCADE,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge_key)
);
CREATE INDEX idx_user_badges_user ON public.user_badges(user_id, unlocked_at DESC);
GRANT SELECT ON public.user_badges TO authenticated;
GRANT ALL ON public.user_badges TO service_role;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read own + partner badges"
  ON public.user_badges FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_partner_of(auth.uid(), user_id));

-- =========================
-- TOGETHER STREAKS
-- =========================
CREATE TABLE public.together_streaks (
  pair_key text PRIMARY KEY,
  user_a uuid NOT NULL,
  user_b uuid NOT NULL,
  current_streak int NOT NULL DEFAULT 0,
  longest_streak int NOT NULL DEFAULT 0,
  last_shared_day date,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.together_streaks TO authenticated;
GRANT ALL ON public.together_streaks TO service_role;
ALTER TABLE public.together_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read own pair streak"
  ON public.together_streaks FOR SELECT TO authenticated
  USING (user_a = auth.uid() OR user_b = auth.uid());

-- =========================
-- WEEKLY CHALLENGES
-- =========================
CREATE TABLE public.weekly_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_key text NOT NULL,
  user_a uuid NOT NULL,
  user_b uuid NOT NULL,
  week_start date NOT NULL,
  challenge_kind text NOT NULL,
  goal int NOT NULL,
  progress int NOT NULL DEFAULT 0,
  title text NOT NULL,
  description text NOT NULL,
  reward_xp int NOT NULL DEFAULT 100,
  claimed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(pair_key, week_start)
);
CREATE INDEX idx_weekly_challenges_pair ON public.weekly_challenges(pair_key, week_start DESC);
GRANT SELECT ON public.weekly_challenges TO authenticated;
GRANT ALL ON public.weekly_challenges TO service_role;
ALTER TABLE public.weekly_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read own pair challenges"
  ON public.weekly_challenges FOR SELECT TO authenticated
  USING (user_a = auth.uid() OR user_b = auth.uid());

-- =========================
-- HELPERS
-- =========================
CREATE OR REPLACE FUNCTION public.pair_key_for(a uuid, b uuid)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN a::text < b::text
              THEN a::text || ':' || b::text
              ELSE b::text || ':' || a::text END;
$$;

CREATE OR REPLACE FUNCTION public.xp_to_level(xp int)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT GREATEST(1, floor(sqrt(GREATEST(xp,0)::numeric / 50))::int + 1);
$$;

CREATE OR REPLACE VIEW public.user_xp_totals AS
  SELECT
    u.id AS user_id,
    COALESCE(SUM(e.amount), 0)::int AS total_xp,
    public.xp_to_level(COALESCE(SUM(e.amount), 0)::int) AS level
  FROM auth.users u
  LEFT JOIN public.user_xp_events e ON e.user_id = u.id
  GROUP BY u.id;

GRANT SELECT ON public.user_xp_totals TO authenticated;

-- =========================
-- CORE XP AWARD FUNCTION
-- =========================
CREATE OR REPLACE FUNCTION public.award_xp(
  p_user uuid, p_kind text, p_amount int,
  p_ref_id uuid DEFAULT NULL, p_ref_type text DEFAULT NULL, p_meta jsonb DEFAULT '{}'::jsonb
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  old_level int;
  new_level int;
  new_total int;
  partner_id uuid;
  sender_name text;
BEGIN
  IF p_user IS NULL OR p_amount IS NULL OR p_amount = 0 THEN RETURN false; END IF;

  SELECT level, total_xp INTO old_level, new_total FROM public.user_xp_totals WHERE user_id = p_user;
  old_level := COALESCE(old_level, 1);

  BEGIN
    INSERT INTO public.user_xp_events(user_id, kind, amount, ref_id, ref_type, meta)
    VALUES (p_user, p_kind, p_amount, p_ref_id, p_ref_type, COALESCE(p_meta, '{}'::jsonb));
  EXCEPTION WHEN unique_violation THEN
    RETURN false;
  END;

  SELECT level, total_xp INTO new_level, new_total FROM public.user_xp_totals WHERE user_id = p_user;

  IF new_level > old_level THEN
    SELECT COALESCE(name, email, 'Your partner') INTO sender_name
      FROM public.profiles WHERE id = p_user;
    INSERT INTO public.notification_queue(user_id, kind, title, body, url, data)
    VALUES (p_user, 'level_up',
            'Level ' || new_level || ' unlocked! ⭐',
            'You earned ' || p_amount || ' XP — keep going.',
            '/home',
            jsonb_build_object('level', new_level, 'total_xp', new_total));

    FOR partner_id IN
      SELECT sp.partner_id FROM public.study_partners sp WHERE sp.user_id = p_user
      UNION
      SELECT sp.user_id FROM public.study_partners sp WHERE sp.partner_id = p_user
    LOOP
      INSERT INTO public.notification_queue(user_id, kind, title, body, url, data)
      VALUES (partner_id, 'partner_level_up',
              sender_name || ' just hit Level ' || new_level || ' 🎉',
              'Send them a cheer!',
              '/home',
              jsonb_build_object('from', p_user, 'level', new_level));
    END LOOP;
  END IF;

  RETURN true;
END $$;

-- =========================
-- BADGE UNLOCK HELPER
-- =========================
CREATE OR REPLACE FUNCTION public.unlock_badge(p_user uuid, p_badge_key text, p_context jsonb DEFAULT '{}'::jsonb)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  reward int;
  b_title text; b_emoji text;
  partner_id uuid; sender_name text;
  inserted boolean := false;
BEGIN
  IF p_user IS NULL OR p_badge_key IS NULL THEN RETURN false; END IF;
  SELECT xp_reward, title, emoji INTO reward, b_title, b_emoji FROM public.badges WHERE key = p_badge_key;
  IF NOT FOUND THEN RETURN false; END IF;

  BEGIN
    INSERT INTO public.user_badges(user_id, badge_key, context) VALUES (p_user, p_badge_key, p_context);
    inserted := true;
  EXCEPTION WHEN unique_violation THEN
    RETURN false;
  END;

  IF inserted THEN
    PERFORM public.award_xp(p_user, 'badge:' || p_badge_key, reward, NULL, 'badge', jsonb_build_object('badge_key', p_badge_key));

    INSERT INTO public.notification_queue(user_id, kind, title, body, url, data)
    VALUES (p_user, 'badge_unlocked',
            b_emoji || ' ' || b_title || ' unlocked!',
            'You earned ' || reward || ' XP',
            '/home',
            jsonb_build_object('badge_key', p_badge_key));

    SELECT COALESCE(name, email, 'Your partner') INTO sender_name FROM public.profiles WHERE id = p_user;
    FOR partner_id IN
      SELECT sp.partner_id FROM public.study_partners sp WHERE sp.user_id = p_user
      UNION
      SELECT sp.user_id FROM public.study_partners sp WHERE sp.partner_id = p_user
    LOOP
      INSERT INTO public.notification_queue(user_id, kind, title, body, url, data)
      VALUES (partner_id, 'partner_badge',
              sender_name || ' unlocked ' || b_emoji || ' ' || b_title,
              'Cheer them on!',
              '/home',
              jsonb_build_object('from', p_user, 'badge_key', p_badge_key));
    END LOOP;
  END IF;
  RETURN inserted;
END $$;

-- =========================
-- TRIGGERS: XP + BADGES
-- =========================

-- topic completion
CREATE OR REPLACE FUNCTION public.gamify_topic_complete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  total_done int;
BEGIN
  IF NEW.completed = true AND (OLD IS NULL OR OLD.completed = false) THEN
    PERFORM public.award_xp(NEW.user_id, 'topic_complete', 10, NEW.topic_id, 'topic');

    SELECT count(*) INTO total_done FROM public.topic_progress
      WHERE user_id = NEW.user_id AND completed = true;

    IF total_done = 1  THEN PERFORM public.unlock_badge(NEW.user_id, 'first_topic'); END IF;
    IF total_done = 10 THEN PERFORM public.unlock_badge(NEW.user_id, 'topics_10'); END IF;
    IF total_done = 50 THEN PERFORM public.unlock_badge(NEW.user_id, 'topics_50'); END IF;
    IF total_done = 100 THEN PERFORM public.unlock_badge(NEW.user_id, 'topics_100'); END IF;

    -- update weekly challenge progress (topic-based)
    UPDATE public.weekly_challenges
       SET progress = LEAST(goal, progress + 1)
     WHERE (user_a = NEW.user_id OR user_b = NEW.user_id)
       AND week_start = date_trunc('week', current_date)::date
       AND challenge_kind = 'topics_together';

    -- night owl heuristic: completed_at hour >= 23 (UTC)
    IF NEW.completed_at IS NOT NULL AND extract(hour from NEW.completed_at at time zone 'Asia/Kolkata') >= 23 THEN
      DECLARE nights int;
      BEGIN
        SELECT count(DISTINCT date(completed_at at time zone 'Asia/Kolkata'))
          INTO nights FROM public.topic_progress
         WHERE user_id = NEW.user_id AND completed = true
           AND extract(hour from completed_at at time zone 'Asia/Kolkata') >= 23;
        IF nights >= 5 THEN PERFORM public.unlock_badge(NEW.user_id, 'night_owl'); END IF;
      END;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_gamify_topic_complete ON public.topic_progress;
CREATE TRIGGER trg_gamify_topic_complete
  AFTER INSERT OR UPDATE ON public.topic_progress
  FOR EACH ROW EXECUTE FUNCTION public.gamify_topic_complete();

-- subject completion piggybacks on existing subject_complete trigger context; add own trigger
CREATE OR REPLACE FUNCTION public.gamify_subject_complete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  subj_id uuid; total_topics int; done_topics int; done_subjects int;
BEGIN
  IF NEW.completed <> true THEN RETURN NEW; END IF;
  IF OLD IS NOT NULL AND OLD.completed = true THEN RETURN NEW; END IF;
  SELECT subject_id INTO subj_id FROM public.topics WHERE id = NEW.topic_id;
  IF subj_id IS NULL THEN RETURN NEW; END IF;
  SELECT count(*) INTO total_topics FROM public.topics WHERE subject_id = subj_id;
  IF total_topics = 0 THEN RETURN NEW; END IF;
  SELECT count(*) INTO done_topics FROM public.topic_progress tp
    JOIN public.topics t ON t.id = tp.topic_id
    WHERE t.subject_id = subj_id AND tp.user_id = NEW.user_id AND tp.completed = true;
  IF done_topics < total_topics THEN RETURN NEW; END IF;

  PERFORM public.award_xp(NEW.user_id, 'subject_complete', 150, subj_id, 'subject');

  SELECT count(DISTINCT t.subject_id) INTO done_subjects
    FROM public.topic_progress tp JOIN public.topics t ON t.id = tp.topic_id
    WHERE tp.user_id = NEW.user_id AND tp.completed = true
      AND NOT EXISTS (
        SELECT 1 FROM public.topics t2
         LEFT JOIN public.topic_progress tp2 ON tp2.topic_id = t2.id AND tp2.user_id = NEW.user_id AND tp2.completed = true
         WHERE t2.subject_id = t.subject_id AND tp2.id IS NULL
      );
  IF done_subjects >= 1 THEN PERFORM public.unlock_badge(NEW.user_id, 'first_subject'); END IF;
  IF done_subjects >= 5 THEN PERFORM public.unlock_badge(NEW.user_id, 'subjects_5'); END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_gamify_subject_complete ON public.topic_progress;
CREATE TRIGGER trg_gamify_subject_complete
  AFTER INSERT OR UPDATE ON public.topic_progress
  FOR EACH ROW EXECUTE FUNCTION public.gamify_subject_complete();

-- quiz answers
CREATE OR REPLACE FUNCTION public.gamify_quiz_answer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  answered int;
BEGIN
  IF NEW.is_correct THEN PERFORM public.award_xp(NEW.user_id, 'quiz_correct', 5, NEW.id, 'quiz_answer'); END IF;
  SELECT count(*) INTO answered FROM public.quiz_answers WHERE user_id = NEW.user_id;
  IF answered = 1   THEN PERFORM public.unlock_badge(NEW.user_id, 'first_quiz'); END IF;
  IF answered = 100 THEN PERFORM public.unlock_badge(NEW.user_id, 'mcq_100'); END IF;
  IF answered = 500 THEN PERFORM public.unlock_badge(NEW.user_id, 'mcq_500'); END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_gamify_quiz_answer ON public.quiz_answers;
CREATE TRIGGER trg_gamify_quiz_answer
  AFTER INSERT ON public.quiz_answers FOR EACH ROW EXECUTE FUNCTION public.gamify_quiz_answer();

-- quiz session end: check score-based badges + XP bonus
CREATE OR REPLACE FUNCTION public.gamify_quiz_session_finish()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  attempted int; correct int; pct numeric;
BEGIN
  IF NEW.status = 'finished' AND (OLD IS NULL OR OLD.status <> 'finished') THEN
    attempted := COALESCE(NEW.attempted_count, 0);
    correct := COALESCE(NEW.correct_count, 0);
    IF attempted >= 5 THEN
      pct := (correct::numeric / attempted::numeric) * 100;
      IF pct >= 80 THEN
        PERFORM public.award_xp(NEW.user_id, 'quiz_bonus', 25, NEW.session_id, 'quiz_session');
      END IF;
      IF pct >= 90 THEN PERFORM public.unlock_badge(NEW.user_id, 'sharpshooter', jsonb_build_object('pct', pct)); END IF;
      IF pct = 100 THEN PERFORM public.unlock_badge(NEW.user_id, 'perfectionist'); END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_gamify_quiz_session_finish ON public.quiz_session_players;
CREATE TRIGGER trg_gamify_quiz_session_finish
  AFTER UPDATE ON public.quiz_session_players
  FOR EACH ROW EXECUTE FUNCTION public.gamify_quiz_session_finish();

-- focus session end
CREATE OR REPLACE FUNCTION public.gamify_focus_end()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.state = 'ended' AND (OLD IS NULL OR OLD.state <> 'ended') THEN
    IF NEW.duration_min >= 25 THEN
      PERFORM public.award_xp(NEW.host_id, 'focus_session', 50, NEW.id, 'focus');
      PERFORM public.unlock_badge(NEW.host_id, 'first_focus');
      IF NEW.duration_min >= 90 THEN PERFORM public.unlock_badge(NEW.host_id, 'focus_marathon'); END IF;
      IF NEW.partner_id IS NOT NULL AND NEW.joined_by_partner THEN
        PERFORM public.award_xp(NEW.partner_id, 'focus_session', 50, NEW.id, 'focus');
        PERFORM public.unlock_badge(NEW.partner_id, 'first_focus');
        IF NEW.duration_min >= 90 THEN PERFORM public.unlock_badge(NEW.partner_id, 'focus_marathon'); END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_gamify_focus_end ON public.focus_sessions;
CREATE TRIGGER trg_gamify_focus_end
  AFTER UPDATE ON public.focus_sessions
  FOR EACH ROW EXECUTE FUNCTION public.gamify_focus_end();

-- reactions sent → Motivator + XP
CREATE OR REPLACE FUNCTION public.gamify_reaction_sent()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sent_today int; sent_total int;
BEGIN
  SELECT count(*) INTO sent_today FROM public.reactions
    WHERE from_user = NEW.from_user AND created_at::date = current_date;
  IF sent_today <= 10 THEN
    PERFORM public.award_xp(NEW.from_user, 'reaction_sent', 3, NEW.id, 'reaction');
  END IF;
  SELECT count(*) INTO sent_total FROM public.reactions WHERE from_user = NEW.from_user;
  IF sent_total >= 10 THEN PERFORM public.unlock_badge(NEW.from_user, 'motivator'); END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_gamify_reaction_sent ON public.reactions;
CREATE TRIGGER trg_gamify_reaction_sent
  AFTER INSERT ON public.reactions FOR EACH ROW EXECUTE FUNCTION public.gamify_reaction_sent();

-- daily check-ins → Early Bird, night XP
CREATE OR REPLACE FUNCTION public.gamify_checkin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE mornings int; sync_days int;
BEGIN
  IF (OLD IS NULL OR OLD.morning_at IS NULL) AND NEW.morning_at IS NOT NULL THEN
    IF extract(hour from NEW.morning_at at time zone 'Asia/Kolkata') < 7 THEN
      SELECT count(*) INTO mornings FROM public.daily_checkins
        WHERE user_id = NEW.user_id AND morning_at IS NOT NULL
          AND extract(hour from morning_at at time zone 'Asia/Kolkata') < 7;
      IF mornings >= 5 THEN PERFORM public.unlock_badge(NEW.user_id, 'early_bird'); END IF;
    END IF;
  END IF;
  IF (OLD IS NULL OR OLD.night_at IS NULL) AND NEW.night_at IS NOT NULL AND NEW.night_status = 'yes' THEN
    PERFORM public.award_xp(NEW.user_id, 'night_goal_hit', 20, NEW.id, 'checkin');
    -- Sync duo check: partner also hit yes today
    SELECT count(*) INTO sync_days FROM public.daily_checkins mine
      JOIN public.study_partners sp
        ON (sp.user_id = mine.user_id AND sp.partner_id IN (
             SELECT user_id FROM public.daily_checkins yours
              WHERE yours.date = mine.date AND yours.night_status = 'yes'))
        OR (sp.partner_id = mine.user_id AND sp.user_id IN (
             SELECT user_id FROM public.daily_checkins yours
              WHERE yours.date = mine.date AND yours.night_status = 'yes'))
      WHERE mine.user_id = NEW.user_id AND mine.night_status = 'yes';
    IF sync_days >= 5 THEN PERFORM public.unlock_badge(NEW.user_id, 'sync_duo'); END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_gamify_checkin ON public.daily_checkins;
CREATE TRIGGER trg_gamify_checkin
  AFTER INSERT OR UPDATE ON public.daily_checkins
  FOR EACH ROW EXECUTE FUNCTION public.gamify_checkin();

-- partner add → First Partner
CREATE OR REPLACE FUNCTION public.gamify_partner_added()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.unlock_badge(NEW.user_id, 'first_partner');
  PERFORM public.unlock_badge(NEW.partner_id, 'first_partner');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_gamify_partner_added ON public.study_partners;
CREATE TRIGGER trg_gamify_partner_added
  AFTER INSERT ON public.study_partners
  FOR EACH ROW EXECUTE FUNCTION public.gamify_partner_added();

-- =========================
-- TOGETHER STREAK RPC (idempotent, callable client-side)
-- =========================
CREATE OR REPLACE FUNCTION public.refresh_together_streak()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := auth.uid();
  partner uuid;
  pk text;
  d date := current_date;
  streak int := 0;
  has_a boolean; has_b boolean;
BEGIN
  IF me IS NULL THEN RETURN; END IF;
  partner := public.my_partner_id();
  IF partner IS NULL THEN RETURN; END IF;
  pk := public.pair_key_for(me, partner);

  LOOP
    SELECT EXISTS (SELECT 1 FROM public.topic_progress WHERE user_id = me AND completed = true AND (completed_at at time zone 'Asia/Kolkata')::date = d) INTO has_a;
    SELECT EXISTS (SELECT 1 FROM public.topic_progress WHERE user_id = partner AND completed = true AND (completed_at at time zone 'Asia/Kolkata')::date = d) INTO has_b;
    EXIT WHEN NOT (has_a AND has_b);
    streak := streak + 1;
    d := d - 1;
  END LOOP;

  INSERT INTO public.together_streaks(pair_key, user_a, user_b, current_streak, longest_streak, last_shared_day, updated_at)
  VALUES (pk, LEAST(me, partner), GREATEST(me, partner), streak, streak, current_date, now())
  ON CONFLICT (pair_key) DO UPDATE
    SET current_streak = EXCLUDED.current_streak,
        longest_streak = GREATEST(together_streaks.longest_streak, EXCLUDED.current_streak),
        last_shared_day = current_date,
        updated_at = now();

  -- milestone badges
  IF streak >= 7 THEN
    PERFORM public.unlock_badge(me, 'together_7');
    PERFORM public.unlock_badge(partner, 'together_7');
  END IF;
  IF streak >= 30 THEN
    PERFORM public.unlock_badge(me, 'together_30');
    PERFORM public.unlock_badge(partner, 'together_30');
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.refresh_together_streak() TO authenticated;

-- =========================
-- WEEKLY CHALLENGE RPCs
-- =========================
CREATE OR REPLACE FUNCTION public.ensure_weekly_challenge()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := auth.uid();
  partner uuid;
  pk text;
  wk date := date_trunc('week', current_date)::date;
  existing uuid;
  cur_topics int;
BEGIN
  IF me IS NULL THEN RETURN NULL; END IF;
  partner := public.my_partner_id();
  IF partner IS NULL THEN RETURN NULL; END IF;
  pk := public.pair_key_for(me, partner);

  SELECT id INTO existing FROM public.weekly_challenges WHERE pair_key = pk AND week_start = wk;
  IF existing IS NOT NULL THEN
    -- refresh progress from current-week topic completions
    SELECT count(*) INTO cur_topics FROM public.topic_progress
      WHERE user_id IN (me, partner) AND completed = true
        AND (completed_at at time zone 'Asia/Kolkata')::date >= wk;
    UPDATE public.weekly_challenges
       SET progress = LEAST(goal, cur_topics)
     WHERE id = existing AND challenge_kind = 'topics_together';
    RETURN existing;
  END IF;

  INSERT INTO public.weekly_challenges(pair_key, user_a, user_b, week_start, challenge_kind, goal, title, description, reward_xp)
  VALUES (pk, LEAST(me, partner), GREATEST(me, partner), wk,
          'topics_together', 20,
          'Twenty topics together',
          'Wrap up 20 topics between the two of you this week',
          150)
  RETURNING id INTO existing;

  SELECT count(*) INTO cur_topics FROM public.topic_progress
    WHERE user_id IN (me, partner) AND completed = true
      AND (completed_at at time zone 'Asia/Kolkata')::date >= wk;
  UPDATE public.weekly_challenges SET progress = LEAST(goal, cur_topics) WHERE id = existing;

  RETURN existing;
END $$;
GRANT EXECUTE ON FUNCTION public.ensure_weekly_challenge() TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_weekly_challenge(p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := auth.uid();
  ch public.weekly_challenges%ROWTYPE;
BEGIN
  IF me IS NULL THEN RETURN false; END IF;
  SELECT * INTO ch FROM public.weekly_challenges WHERE id = p_id;
  IF NOT FOUND THEN RETURN false; END IF;
  IF ch.user_a <> me AND ch.user_b <> me THEN RETURN false; END IF;
  IF ch.claimed OR ch.progress < ch.goal THEN RETURN false; END IF;
  UPDATE public.weekly_challenges SET claimed = true WHERE id = p_id;
  PERFORM public.award_xp(ch.user_a, 'weekly_challenge', ch.reward_xp, ch.id, 'challenge');
  PERFORM public.award_xp(ch.user_b, 'weekly_challenge', ch.reward_xp, ch.id, 'challenge');
  RETURN true;
END $$;
GRANT EXECUTE ON FUNCTION public.claim_weekly_challenge(uuid) TO authenticated;

-- ensure realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_xp_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_badges;
ALTER PUBLICATION supabase_realtime ADD TABLE public.weekly_challenges;
ALTER PUBLICATION supabase_realtime ADD TABLE public.together_streaks;
