CREATE OR REPLACE FUNCTION public.reset_own_study_progress(p_confirmation text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_confirmation IS DISTINCT FROM 'RESET' THEN RAISE EXCEPTION 'confirmation_required'; END IF;
  PERFORM 1 FROM public.profiles WHERE id = v_me FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'account_not_found'; END IF;
  DELETE FROM public.topic_progress WHERE user_id = v_me;
  DELETE FROM public.daily_tasks WHERE user_id = v_me;
  DELETE FROM public.daily_checkins WHERE user_id = v_me;
  DELETE FROM public.weekly_task_progress WHERE user_id = v_me;
  DELETE FROM public.weekly_task_completions WHERE user_id = v_me;
  DELETE FROM public.quiz_answers WHERE user_id = v_me;
  DELETE FROM public.quiz_wrong_bank WHERE user_id = v_me;
  DELETE FROM public.quiz_session_players WHERE user_id = v_me;
  DELETE FROM public.focus_participants WHERE user_id = v_me;
  -- Keep the other participant's history; remove the resetting user's membership.
  UPDATE public.focus_sessions SET host_id = partner_id, partner_id = NULL, joined_by_partner = false
    WHERE host_id = v_me AND partner_id IS NOT NULL AND partner_id <> v_me;
  DELETE FROM public.focus_sessions WHERE host_id = v_me;
  UPDATE public.focus_sessions SET partner_id = NULL, joined_by_partner = false WHERE partner_id = v_me;
  UPDATE public.quiz_sessions SET host_id = partner_id, partner_id = NULL
    WHERE host_id = v_me AND partner_id IS NOT NULL AND partner_id <> v_me;
  DELETE FROM public.quiz_sessions WHERE host_id = v_me;
  UPDATE public.quiz_sessions SET partner_id = NULL WHERE partner_id = v_me;
  DELETE FROM public.user_xp_events WHERE user_id = v_me;
  DELETE FROM public.user_xp_totals WHERE user_id = v_me;
  DELETE FROM public.user_badges WHERE user_id = v_me;
  UPDATE public.together_streaks SET current_streak = 0, longest_streak = 0, last_shared_day = NULL, updated_at = now()
    WHERE user_a = v_me OR user_b = v_me;
  UPDATE public.weekly_challenges SET progress = 0, claimed = false WHERE user_a = v_me OR user_b = v_me;
  DELETE FROM public.notification_queue WHERE user_id = v_me;
  UPDATE public.presence SET status = 'online', current_activity = NULL, updated_at = now() WHERE user_id = v_me;
END;
$$;
REVOKE ALL ON FUNCTION public.reset_own_study_progress(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_own_study_progress(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.prepare_own_account_deletion(p_user_id uuid, p_confirmation text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_partner uuid;
BEGIN
  IF p_user_id IS NULL OR p_confirmation IS DISTINCT FROM 'DELETE' THEN RAISE EXCEPTION 'confirmation_required'; END IF;
  PERFORM 1 FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  SELECT partner_id INTO v_partner FROM public.study_partners WHERE user_id = p_user_id LIMIT 1;
  -- Transfer the shared syllabus rather than cascading away the survivor's progress.
  IF v_partner IS NOT NULL THEN
    UPDATE public.subjects SET owner_id = v_partner WHERE owner_id = p_user_id;
    UPDATE public.topics SET owner_id = v_partner WHERE owner_id = p_user_id;
  END IF;
  DELETE FROM public.quiz_answers WHERE user_id = p_user_id;
  DELETE FROM public.quiz_bookmarks WHERE user_id = p_user_id;
  DELETE FROM public.quiz_wrong_bank WHERE user_id = p_user_id;
  DELETE FROM public.quiz_session_players WHERE user_id = p_user_id;
  UPDATE public.quiz_sessions SET host_id = partner_id, partner_id = NULL WHERE host_id = p_user_id AND partner_id IS NOT NULL AND partner_id <> p_user_id;
  DELETE FROM public.quiz_sessions WHERE host_id = p_user_id;
  UPDATE public.quiz_sessions SET partner_id = NULL WHERE partner_id = p_user_id;
  -- Shared question content used by surviving students is retained without creator identity.
  DELETE FROM public.quiz_questions q WHERE q.created_by = p_user_id
    AND NOT EXISTS (SELECT 1 FROM public.quiz_answers a WHERE a.question_id = q.id)
    AND NOT EXISTS (SELECT 1 FROM public.quiz_bookmarks b WHERE b.question_id = q.id)
    AND NOT EXISTS (SELECT 1 FROM public.quiz_wrong_bank w WHERE w.question_id = q.id)
    AND NOT EXISTS (SELECT 1 FROM public.quiz_session_questions s WHERE s.question_id = q.id);
  UPDATE public.quiz_questions SET created_by = NULL WHERE created_by = p_user_id;
  DELETE FROM public.quiz_chunks WHERE user_id = p_user_id;
  DELETE FROM public.quiz_documents WHERE user_id = p_user_id;
  DELETE FROM public.focus_participants WHERE user_id = p_user_id;
  UPDATE public.focus_sessions SET host_id = partner_id, partner_id = NULL, joined_by_partner = false WHERE host_id = p_user_id AND partner_id IS NOT NULL AND partner_id <> p_user_id;
  DELETE FROM public.focus_sessions WHERE host_id = p_user_id;
  UPDATE public.focus_sessions SET partner_id = NULL, joined_by_partner = false WHERE partner_id = p_user_id;
  DELETE FROM public.weekly_task_progress WHERE user_id = p_user_id;
  DELETE FROM public.weekly_task_completions WHERE user_id = p_user_id;
  UPDATE public.weekly_tasks SET created_by = CASE WHEN user_a = p_user_id THEN user_b ELSE user_a END,
    pair_key = public.pair_key_for(CASE WHEN user_a = p_user_id THEN user_b ELSE user_a END, CASE WHEN user_a = p_user_id THEN user_b ELSE user_a END),
    user_a = CASE WHEN user_a = p_user_id THEN user_b ELSE user_a END,
    user_b = CASE WHEN user_a = p_user_id THEN user_b ELSE user_a END
    WHERE (user_a = p_user_id OR user_b = p_user_id) AND user_a <> user_b;
  DELETE FROM public.weekly_tasks WHERE user_a = p_user_id OR user_b = p_user_id;
  DELETE FROM public.together_streaks WHERE user_a = p_user_id OR user_b = p_user_id;
  DELETE FROM public.weekly_challenges WHERE user_a = p_user_id OR user_b = p_user_id;
  DELETE FROM public.partner_merge_log WHERE keeper_id = p_user_id OR absorbed_id = p_user_id;
  DELETE FROM public.rate_limits WHERE user_id = p_user_id;
  DELETE FROM public.board_seen WHERE user_id = p_user_id;
  DELETE FROM public.daily_tasks WHERE user_id = p_user_id;
  DELETE FROM public.daily_checkins WHERE user_id = p_user_id;
  DELETE FROM public.topic_progress WHERE user_id = p_user_id;
  DELETE FROM public.user_badges WHERE user_id = p_user_id;
  DELETE FROM public.user_xp_events WHERE user_id = p_user_id;
  DELETE FROM public.user_xp_totals WHERE user_id = p_user_id;
  DELETE FROM public.notification_queue WHERE user_id = p_user_id;
  DELETE FROM public.push_subscriptions WHERE user_id = p_user_id;
  DELETE FROM public.presence WHERE user_id = p_user_id;
  DELETE FROM public.pokes WHERE from_user = p_user_id OR to_user = p_user_id;
  DELETE FROM public.reactions WHERE from_user = p_user_id OR to_user = p_user_id;
  DELETE FROM public.partner_invites WHERE from_user = p_user_id OR to_user = p_user_id;
  DELETE FROM public.study_partners WHERE user_id = p_user_id OR partner_id = p_user_id;
  UPDATE public.subjects SET created_by = NULL WHERE created_by = p_user_id;
  UPDATE public.topics SET added_by = NULL WHERE added_by = p_user_id;
  DELETE FROM public.subjects WHERE owner_id = p_user_id;
  DELETE FROM public.topics WHERE owner_id = p_user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.prepare_own_account_deletion(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_own_account_deletion(uuid, text) TO service_role;