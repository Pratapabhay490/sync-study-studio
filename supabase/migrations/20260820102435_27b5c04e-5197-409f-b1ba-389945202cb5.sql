-- ============ 1. Unique constraint: subject names scoped per owner ============
ALTER TABLE public.subjects DROP CONSTRAINT IF EXISTS subjects_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS subjects_owner_name_key ON public.subjects (owner_id, name);

-- ============ 2. Indexes ============
-- partner lookups (is_partner_of reverse direction had no index)
CREATE INDEX IF NOT EXISTS study_partners_partner_idx ON public.study_partners (partner_id, user_id);

-- topic_progress: user timeline / streak / weekly counts
DROP INDEX IF EXISTS public.topic_progress_user_id_idx; -- prefix of the composite below
CREATE INDEX IF NOT EXISTS topic_progress_user_completed_idx
  ON public.topic_progress (user_id, completed, completed_at DESC);
CREATE INDEX IF NOT EXISTS topic_progress_user_revisions_idx
  ON public.topic_progress (user_id, revisions) WHERE revisions > 0;

-- topics: subject detail listing (filter + order)
DROP INDEX IF EXISTS public.topics_subject_id_idx; -- prefix of the composite below
CREATE INDEX IF NOT EXISTS topics_subject_created_idx ON public.topics (subject_id, created_at);

-- subjects list ordered by name
CREATE INDEX IF NOT EXISTS subjects_owner_name_idx ON public.subjects (owner_id, name);

-- notification history
CREATE INDEX IF NOT EXISTS notification_queue_user_created_idx
  ON public.notification_queue (user_id, created_at DESC);

-- focus sessions: partner side + study-hours windows
CREATE INDEX IF NOT EXISTS focus_sessions_partner_idx ON public.focus_sessions (partner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS focus_sessions_host_started_idx ON public.focus_sessions (host_id, started_at DESC);
CREATE INDEX IF NOT EXISTS focus_sessions_partner_started_idx ON public.focus_sessions (partner_id, started_at DESC);
CREATE INDEX IF NOT EXISTS focus_sessions_open_idx
  ON public.focus_sessions (ends_at) WHERE state = 'active';

-- quiz lobby / history
CREATE INDEX IF NOT EXISTS quiz_sessions_host_created_idx ON public.quiz_sessions (host_id, created_at DESC);
CREATE INDEX IF NOT EXISTS quiz_sessions_partner_created_idx ON public.quiz_sessions (partner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS quiz_sessions_open_idx
  ON public.quiz_sessions (created_at DESC) WHERE status <> 'finished';
CREATE INDEX IF NOT EXISTS quiz_session_players_user_idx
  ON public.quiz_session_players (user_id, status, joined_at DESC);
CREATE INDEX IF NOT EXISTS quiz_answers_user_idx ON public.quiz_answers (user_id, answered_at DESC);
CREATE INDEX IF NOT EXISTS quiz_wrong_bank_due_idx
  ON public.quiz_wrong_bank (user_id, next_review_at) WHERE resolved = false;
CREATE INDEX IF NOT EXISTS quiz_documents_user_idx ON public.quiz_documents (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS quiz_chunks_user_idx ON public.quiz_chunks (user_id);
CREATE INDEX IF NOT EXISTS quiz_questions_creator_idx ON public.quiz_questions (created_by, created_at DESC);

-- social
CREATE INDEX IF NOT EXISTS pokes_from_idx ON public.pokes (from_user, created_at DESC);
CREATE INDEX IF NOT EXISTS weekly_challenges_user_a_idx ON public.weekly_challenges (user_a, week_start DESC);
CREATE INDEX IF NOT EXISTS weekly_challenges_user_b_idx ON public.weekly_challenges (user_b, week_start DESC);

-- ============ 3. RLS: evaluate auth.uid() once per query, not per row ============
DROP POLICY IF EXISTS "Users view own or partner progress" ON public.topic_progress;
CREATE POLICY "Users view own or partner progress" ON public.topic_progress
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_partner_of((SELECT auth.uid()), user_id));
DROP POLICY IF EXISTS "Users insert own progress" ON public.topic_progress;
CREATE POLICY "Users insert own progress" ON public.topic_progress
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "Users update own progress" ON public.topic_progress;
CREATE POLICY "Users update own progress" ON public.topic_progress
  FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "Users delete own progress" ON public.topic_progress;
CREATE POLICY "Users delete own progress" ON public.topic_progress
  FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Owner or partner view topics" ON public.topics;
CREATE POLICY "Owner or partner view topics" ON public.topics
  FOR SELECT TO authenticated
  USING (owner_id = (SELECT auth.uid()) OR public.is_partner_of((SELECT auth.uid()), owner_id));
DROP POLICY IF EXISTS "Insert own topics" ON public.topics;
CREATE POLICY "Insert own topics" ON public.topics
  FOR INSERT TO authenticated WITH CHECK (owner_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "Owner or partner update topics" ON public.topics;
CREATE POLICY "Owner or partner update topics" ON public.topics
  FOR UPDATE TO authenticated
  USING (owner_id = (SELECT auth.uid()) OR public.is_partner_of((SELECT auth.uid()), owner_id))
  WITH CHECK (owner_id = (SELECT auth.uid()) OR public.is_partner_of((SELECT auth.uid()), owner_id));
DROP POLICY IF EXISTS "Owner or partner delete topics" ON public.topics;
CREATE POLICY "Owner or partner delete topics" ON public.topics
  FOR DELETE TO authenticated
  USING (owner_id = (SELECT auth.uid()) OR public.is_partner_of((SELECT auth.uid()), owner_id));

DROP POLICY IF EXISTS "Owner or partner view subjects" ON public.subjects;
CREATE POLICY "Owner or partner view subjects" ON public.subjects
  FOR SELECT TO authenticated
  USING (owner_id = (SELECT auth.uid()) OR public.is_partner_of((SELECT auth.uid()), owner_id));
DROP POLICY IF EXISTS "Insert own subjects" ON public.subjects;
CREATE POLICY "Insert own subjects" ON public.subjects
  FOR INSERT TO authenticated WITH CHECK (owner_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "Owner or partner update subjects" ON public.subjects;
CREATE POLICY "Owner or partner update subjects" ON public.subjects
  FOR UPDATE TO authenticated
  USING (owner_id = (SELECT auth.uid()) OR public.is_partner_of((SELECT auth.uid()), owner_id))
  WITH CHECK (owner_id = (SELECT auth.uid()) OR public.is_partner_of((SELECT auth.uid()), owner_id));
DROP POLICY IF EXISTS "Owner or partner delete subjects" ON public.subjects;
CREATE POLICY "Owner or partner delete subjects" ON public.subjects
  FOR DELETE TO authenticated
  USING (owner_id = (SELECT auth.uid()) OR public.is_partner_of((SELECT auth.uid()), owner_id));

DROP POLICY IF EXISTS "focus read own or partner" ON public.focus_sessions;
CREATE POLICY "focus read own or partner" ON public.focus_sessions
  FOR SELECT TO authenticated
  USING (host_id = (SELECT auth.uid()) OR partner_id = (SELECT auth.uid())
         OR (partner_id IS NULL AND public.is_partner_of((SELECT auth.uid()), host_id)));
DROP POLICY IF EXISTS "focus insert host" ON public.focus_sessions;
CREATE POLICY "focus insert host" ON public.focus_sessions
  FOR INSERT TO authenticated WITH CHECK (host_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "focus update participant" ON public.focus_sessions;
CREATE POLICY "focus update participant" ON public.focus_sessions
  FOR UPDATE TO authenticated
  USING (host_id = (SELECT auth.uid()) OR partner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "users see own queued" ON public.notification_queue;
CREATE POLICY "users see own queued" ON public.notification_queue
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "read own pair challenges" ON public.weekly_challenges;
CREATE POLICY "read own pair challenges" ON public.weekly_challenges
  FOR SELECT TO authenticated
  USING (user_a = (SELECT auth.uid()) OR user_b = (SELECT auth.uid()));

DROP POLICY IF EXISTS "session participants read" ON public.quiz_sessions;
CREATE POLICY "session participants read" ON public.quiz_sessions
  FOR SELECT TO authenticated
  USING (host_id = (SELECT auth.uid()) OR partner_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "session host insert" ON public.quiz_sessions;
CREATE POLICY "session host insert" ON public.quiz_sessions
  FOR INSERT TO authenticated WITH CHECK (host_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "session host update" ON public.quiz_sessions;
CREATE POLICY "session host update" ON public.quiz_sessions
  FOR UPDATE TO authenticated
  USING (host_id = (SELECT auth.uid()) OR partner_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "session host delete" ON public.quiz_sessions;
CREATE POLICY "session host delete" ON public.quiz_sessions
  FOR DELETE TO authenticated USING (host_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "presence partner read" ON public.presence;
CREATE POLICY "presence partner read" ON public.presence
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.is_partner_of((SELECT auth.uid()), user_id));
DROP POLICY IF EXISTS "presence self write" ON public.presence;
CREATE POLICY "presence self write" ON public.presence
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "Partners can view each other profile" ON public.profiles;
CREATE POLICY "Partners can view each other profile" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_partner_of((SELECT auth.uid()), id));
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;
CREATE POLICY "Users can delete own profile" ON public.profiles
  FOR DELETE TO authenticated USING (id = (SELECT auth.uid()));

-- ============ 4. Stop the weekly-challenge write/refresh feedback loop ============
CREATE OR REPLACE FUNCTION public.ensure_weekly_challenge()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  SELECT count(*) INTO cur_topics FROM public.topic_progress
    WHERE user_id IN (me, partner) AND completed = true
      AND (completed_at at time zone 'Asia/Kolkata')::date >= wk;

  SELECT id INTO existing FROM public.weekly_challenges
    WHERE pair_key = pk AND week_start = wk;

  IF existing IS NOT NULL THEN
    -- only write when the value actually changes, otherwise every read emits a
    -- realtime UPDATE that triggers another read (infinite refresh loop)
    UPDATE public.weekly_challenges w
       SET progress = LEAST(w.goal, cur_topics)
     WHERE w.id = existing
       AND w.challenge_kind = 'topics_together'
       AND w.progress IS DISTINCT FROM LEAST(w.goal, cur_topics);
    RETURN existing;
  END IF;

  INSERT INTO public.weekly_challenges(pair_key, user_a, user_b, week_start, challenge_kind, goal, title, description, reward_xp, progress)
  VALUES (pk, LEAST(me, partner), GREATEST(me, partner), wk,
          'topics_together', 20,
          'Twenty topics together',
          'Wrap up 20 topics between the two of you this week',
          150, LEAST(20, cur_topics))
  ON CONFLICT (pair_key, week_start) DO UPDATE SET pair_key = EXCLUDED.pair_key
  RETURNING id INTO existing;

  RETURN existing;
END
$$;

REVOKE ALL ON FUNCTION public.ensure_weekly_challenge() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_weekly_challenge() TO authenticated;

ANALYZE public.topic_progress;
ANALYZE public.topics;
ANALYZE public.subjects;
ANALYZE public.focus_sessions;
ANALYZE public.weekly_challenges;
ANALYZE public.study_partners;