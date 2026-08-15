ALTER TABLE public.topic_progress
  ADD COLUMN IF NOT EXISTS revisions integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_revised_at timestamptz;

ALTER TABLE public.topic_progress
  DROP CONSTRAINT IF EXISTS topic_progress_revisions_range;
ALTER TABLE public.topic_progress
  ADD CONSTRAINT topic_progress_revisions_range CHECK (revisions >= 0 AND revisions <= 5);

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
    SELECT EXISTS (
      SELECT 1 FROM public.topic_progress
      WHERE user_id = me AND completed = true
        AND (completed_at at time zone 'Asia/Kolkata')::date = d
    ) OR EXISTS (
      SELECT 1 FROM public.focus_sessions
      WHERE (host_id = me OR (partner_id = me AND joined_by_partner = true))
        AND (started_at at time zone 'Asia/Kolkata')::date = d
    ) INTO has_a;

    SELECT EXISTS (
      SELECT 1 FROM public.topic_progress
      WHERE user_id = partner AND completed = true
        AND (completed_at at time zone 'Asia/Kolkata')::date = d
    ) OR EXISTS (
      SELECT 1 FROM public.focus_sessions
      WHERE (host_id = partner OR (partner_id = partner AND joined_by_partner = true))
        AND (started_at at time zone 'Asia/Kolkata')::date = d
    ) INTO has_b;

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

  IF streak >= 7 THEN
    PERFORM public.unlock_badge(me, 'together_7');
    PERFORM public.unlock_badge(partner, 'together_7');
  END IF;
  IF streak >= 30 THEN
    PERFORM public.unlock_badge(me, 'together_30');
    PERFORM public.unlock_badge(partner, 'together_30');
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.refresh_together_streak() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refresh_together_streak() TO authenticated;