CREATE OR REPLACE FUNCTION public.activity_days(p_user uuid, p_days int DEFAULT 120)
RETURNS SETOF date LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH since AS (SELECT now() - make_interval(days => LEAST(GREATEST(p_days,1),400)) AS t),
  ok AS (SELECT auth.uid() IS NOT NULL AND (p_user = auth.uid() OR public.is_partner_of(auth.uid(), p_user)) AS v)
  SELECT DISTINCT (ts AT TIME ZONE 'Asia/Kolkata')::date FROM (
    SELECT completed_at ts FROM topic_progress WHERE user_id=p_user AND completed
    UNION ALL SELECT last_revised_at FROM topic_progress WHERE user_id=p_user
    UNION ALL SELECT started_at FROM focus_sessions WHERE host_id=p_user OR (partner_id=p_user AND joined_by_partner)
    UNION ALL SELECT joined_at FROM focus_participants WHERE user_id=p_user
    UNION ALL SELECT updated_at FROM weekly_task_progress WHERE user_id=p_user AND percent>0
    UNION ALL SELECT completed_at FROM weekly_task_completions WHERE user_id=p_user
    UNION ALL SELECT answered_at FROM quiz_answers WHERE user_id=p_user
    UNION ALL SELECT joined_at FROM quiz_session_players WHERE user_id=p_user
  ) x, since, ok WHERE ok.v AND ts IS NOT NULL AND ts >= since.t;
$$;
REVOKE ALL ON FUNCTION public.activity_days(uuid,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.activity_days(uuid,int) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.refresh_together_streak()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  me uuid := auth.uid(); partner uuid; pk text;
  d date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  streak int := 0; da date[]; db date[];
BEGIN
  IF me IS NULL THEN RETURN; END IF;
  partner := public.my_partner_id();
  IF partner IS NULL THEN RETURN; END IF;
  pk := public.pair_key_for(me, partner);
  SELECT array_agg(x) INTO da FROM public.activity_days(me, 400) x;
  SELECT array_agg(x) INTO db FROM public.activity_days(partner, 400) x;
  -- Today still counts as "in progress": start from yesterday if today isn't shared yet
  IF NOT (d = ANY(coalesce(da,'{}')) AND d = ANY(coalesce(db,'{}'))) THEN d := d - 1; END IF;
  WHILE d = ANY(coalesce(da,'{}')) AND d = ANY(coalesce(db,'{}')) LOOP
    streak := streak + 1; d := d - 1;
  END LOOP;
  INSERT INTO public.together_streaks(pair_key, user_a, user_b, current_streak, longest_streak, last_shared_day, updated_at)
  VALUES (pk, LEAST(me, partner), GREATEST(me, partner), streak, streak, current_date, now())
  ON CONFLICT (pair_key) DO UPDATE
    SET current_streak = EXCLUDED.current_streak,
        longest_streak = GREATEST(together_streaks.longest_streak, EXCLUDED.current_streak),
        last_shared_day = current_date, updated_at = now();
  IF streak >= 7 THEN PERFORM public.unlock_badge(me,'together_7'); PERFORM public.unlock_badge(partner,'together_7'); END IF;
  IF streak >= 30 THEN PERFORM public.unlock_badge(me,'together_30'); PERFORM public.unlock_badge(partner,'together_30'); END IF;
END $function$;