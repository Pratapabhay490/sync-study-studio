
CREATE OR REPLACE FUNCTION public.queue_badge_unlock_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  sender_name text;
  badge_title text;
  badge_emoji text;
  badge_tier text;
  other_user_id uuid;
  msg_title text;
  msg_body text;
BEGIN
  SELECT COALESCE(p.name, p.email, 'Your partner') INTO sender_name
    FROM public.profiles p WHERE p.id = NEW.user_id;

  SELECT b.title, b.emoji, b.tier INTO badge_title, badge_emoji, badge_tier
    FROM public.badges b WHERE b.key = NEW.badge_key;

  IF badge_title IS NULL THEN
    badge_title := NEW.badge_key;
    badge_emoji := '🏅';
    badge_tier := 'bronze';
  END IF;

  msg_title := sender_name || ' unlocked ' || badge_emoji || ' ' || badge_title || '!';
  msg_body  := CASE badge_tier
    WHEN 'gold' then 'Gold tier achievement — send them some love 🌟'
    WHEN 'silver' then 'Silver badge earned — cheer them on ✨'
    ELSE 'New badge unlocked — high-five them! ✋'
  END;

  FOR other_user_id IN
    SELECT partner_id FROM public.study_partners WHERE user_id = NEW.user_id
    UNION
    SELECT user_id FROM public.study_partners WHERE partner_id = NEW.user_id
  LOOP
    INSERT INTO public.notification_queue (user_id, kind, title, body, url, data)
    VALUES (
      other_user_id,
      'badge_unlock',
      msg_title,
      msg_body,
      '/journey',
      jsonb_build_object('from', NEW.user_id, 'badge_key', NEW.badge_key, 'badge_title', badge_title, 'tier', badge_tier)
    );
  END LOOP;

  RETURN NEW;
END $function$;

REVOKE EXECUTE ON FUNCTION public.queue_badge_unlock_notification() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_badge_unlock_notify ON public.user_badges;
CREATE TRIGGER trg_badge_unlock_notify
AFTER INSERT ON public.user_badges
FOR EACH ROW EXECUTE FUNCTION public.queue_badge_unlock_notification();
