CREATE OR REPLACE FUNCTION public.gamify_focus_end()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  actual_min int;
  xp_amount int;
BEGIN
  IF NEW.state = 'ended' AND (OLD IS NULL OR OLD.state <> 'ended') THEN
    -- minutes actually studied (early-ended sessions count only elapsed time)
    actual_min := GREATEST(
      0,
      LEAST(
        NEW.duration_min,
        FLOOR(EXTRACT(EPOCH FROM (LEAST(now(), COALESCE(NEW.updated_at, now())) - NEW.started_at)) / 60)::int
      )
    );

    IF actual_min >= 5 THEN
      -- ~2 XP per minute, capped at 200 per session
      xp_amount := LEAST(200, GREATEST(10, actual_min * 2));

      PERFORM public.award_xp(NEW.host_id, 'focus_session', xp_amount, NEW.id, 'focus',
        jsonb_build_object('minutes', actual_min));
      PERFORM public.unlock_badge(NEW.host_id, 'first_focus');
      IF actual_min >= 90 THEN PERFORM public.unlock_badge(NEW.host_id, 'focus_marathon'); END IF;

      IF NEW.partner_id IS NOT NULL AND NEW.joined_by_partner THEN
        PERFORM public.award_xp(NEW.partner_id, 'focus_session', xp_amount, NEW.id, 'focus',
          jsonb_build_object('minutes', actual_min));
        PERFORM public.unlock_badge(NEW.partner_id, 'first_focus');
        IF actual_min >= 90 THEN PERFORM public.unlock_badge(NEW.partner_id, 'focus_marathon'); END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.gamify_focus_end() FROM public, anon, authenticated;