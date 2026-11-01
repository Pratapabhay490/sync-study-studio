-- Run against the app database with a privileged SQL session.
-- These checks always roll back; no real account is deleted.
BEGIN;
DO $$
DECLARE v_me uuid; v_partner uuid; v_before jsonb; v_after jsonb;
BEGIN
  SELECT user_id, partner_id INTO v_me, v_partner FROM public.study_partners LIMIT 1;
  IF v_me IS NULL THEN RAISE EXCEPTION 'Test requires an existing linked pair'; END IF;
  PERFORM set_config('request.jwt.claim.sub', v_me::text, true);
  SELECT jsonb_build_object(
    'subjects', (SELECT jsonb_agg(to_jsonb(s) ORDER BY id) FROM public.subjects s),
    'topics', (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.topics t),
    'partner', (SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM public.topic_progress p WHERE user_id = v_partner)
  ) INTO v_before;
  BEGIN
    PERFORM public.reset_own_study_progress('');
    RAISE EXCEPTION 'Reset accepted missing confirmation';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'confirmation_required' THEN RAISE; END IF;
  END;
  PERFORM public.reset_own_study_progress('RESET');
  SELECT jsonb_build_object(
    'subjects', (SELECT jsonb_agg(to_jsonb(s) ORDER BY id) FROM public.subjects s),
    'topics', (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.topics t),
    'partner', (SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM public.topic_progress p WHERE user_id = v_partner)
  ) INTO v_after;
  IF v_before IS DISTINCT FROM v_after THEN RAISE EXCEPTION 'Reset changed syllabus edits or partner progress'; END IF;
  IF EXISTS (SELECT 1 FROM public.topic_progress WHERE user_id = v_me)
    OR EXISTS (SELECT 1 FROM public.user_xp_events WHERE user_id = v_me)
    OR EXISTS (SELECT 1 FROM public.user_badges WHERE user_id = v_me)
    OR EXISTS (SELECT 1 FROM public.daily_checkins WHERE user_id = v_me)
    OR EXISTS (SELECT 1 FROM public.daily_tasks WHERE user_id = v_me)
    OR EXISTS (SELECT 1 FROM public.quiz_answers WHERE user_id = v_me)
    OR EXISTS (SELECT 1 FROM public.focus_sessions WHERE host_id = v_me OR partner_id = v_me)
    OR EXISTS (SELECT 1 FROM public.weekly_task_progress WHERE user_id = v_me)
    THEN RAISE EXCEPTION 'Reset left personal progress'; END IF;
  RAISE NOTICE 'Reset preserves all syllabus names/edits and partner progress and clears own progress';
END $$;
ROLLBACK;

BEGIN;
DO $$
DECLARE v_me uuid; v_partner uuid; v_before jsonb; v_after jsonb;
BEGIN
  SELECT user_id, partner_id INTO v_me, v_partner FROM public.study_partners LIMIT 1;
  IF v_me IS NULL THEN RAISE EXCEPTION 'Test requires an existing linked pair'; END IF;
  SELECT jsonb_agg(to_jsonb(p) ORDER BY id) INTO v_before FROM public.topic_progress p WHERE user_id = v_partner;
  PERFORM public.prepare_own_account_deletion(v_me, 'DELETE');
  SELECT jsonb_agg(to_jsonb(p) ORDER BY id) INTO v_after FROM public.topic_progress p WHERE user_id = v_partner;
  IF v_before IS DISTINCT FROM v_after THEN RAISE EXCEPTION 'Deletion changed partner progress'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_partner) THEN RAISE EXCEPTION 'Deletion removed partner account'; END IF;
  IF EXISTS (SELECT 1 FROM public.subjects WHERE owner_id = v_me)
    OR EXISTS (SELECT 1 FROM public.topics WHERE owner_id = v_me)
    OR EXISTS (SELECT 1 FROM public.topic_progress WHERE user_id = v_me)
    OR EXISTS (SELECT 1 FROM public.partner_merge_log WHERE keeper_id = v_me OR absorbed_id = v_me)
    OR EXISTS (SELECT 1 FROM public.study_partners WHERE user_id = v_me OR partner_id = v_me)
    THEN RAISE EXCEPTION 'Deletion left personal study references'; END IF;
  IF has_function_privilege('authenticated', 'public.prepare_own_account_deletion(uuid,text)', 'execute')
    OR has_function_privilege('anon', 'public.prepare_own_account_deletion(uuid,text)', 'execute')
    THEN RAISE EXCEPTION 'Privileged deletion cleanup exposed'; END IF;
  RAISE NOTICE 'Deletion cleanup preserves partner progress/account and removes personal references';
END $$;
ROLLBACK;