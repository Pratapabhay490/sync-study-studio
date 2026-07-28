CREATE OR REPLACE FUNCTION public.queue_topic_complete_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  sender_name text;
  topic_name text;
  subject_name text;
  other_user_id uuid;
BEGIN
  IF NEW.completed = true AND (OLD IS NULL OR OLD.completed = false) THEN
    SELECT COALESCE(NULLIF(btrim(p.name), ''), NULLIF(btrim(split_part(p.email, '@', 1)), ''), 'Your partner')
      INTO sender_name
      FROM public.profiles p WHERE p.id = NEW.user_id;
    sender_name := COALESCE(NULLIF(btrim(sender_name), ''), 'Your partner');

    SELECT t.topic_name, s.name INTO topic_name, subject_name
      FROM public.topics t LEFT JOIN public.subjects s ON s.id = t.subject_id
      WHERE t.id = NEW.topic_id;

    FOR other_user_id IN
      SELECT partner_id FROM public.study_partners WHERE user_id = NEW.user_id
      UNION
      SELECT user_id FROM public.study_partners WHERE partner_id = NEW.user_id
    LOOP
      INSERT INTO public.notification_queue (user_id, kind, title, body, url, data)
      VALUES (
        other_user_id,
        'partner_topic_complete',
        sender_name || ' just finished a topic! 🎉',
        COALESCE(subject_name || ' • ', '') || COALESCE(topic_name, 'a topic'),
        '/dashboard',
        jsonb_build_object('from', NEW.user_id, 'topic_id', NEW.topic_id)
      );
    END LOOP;
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.queue_subject_complete_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  subj_id uuid;
  subj_name text;
  sender_name text;
  total_topics int;
  done_topics int;
  other_user_id uuid;
  msg_title text;
  msg_body text;
  variant int;
  already_sent int;
BEGIN
  IF NEW.completed <> true THEN RETURN NEW; END IF;
  IF OLD IS NOT NULL AND OLD.completed = true THEN RETURN NEW; END IF;

  SELECT t.subject_id INTO subj_id FROM public.topics t WHERE t.id = NEW.topic_id;
  IF subj_id IS NULL THEN RETURN NEW; END IF;

  SELECT count(*) INTO total_topics FROM public.topics WHERE subject_id = subj_id;
  IF total_topics = 0 THEN RETURN NEW; END IF;

  SELECT count(DISTINCT tp.topic_id) INTO done_topics
    FROM public.topic_progress tp
    JOIN public.topics t ON t.id = tp.topic_id
    WHERE t.subject_id = subj_id AND tp.user_id = NEW.user_id AND tp.completed = true;

  IF done_topics < total_topics THEN RETURN NEW; END IF;

  SELECT count(*) INTO already_sent FROM public.notification_queue
    WHERE kind = 'subject_complete'
      AND data->>'subject_id' = subj_id::text
      AND data->>'by_user' = NEW.user_id::text
      AND created_at > now() - interval '6 hours';
  IF already_sent > 0 THEN RETURN NEW; END IF;

  SELECT COALESCE(NULLIF(btrim(p.name), ''), NULLIF(btrim(split_part(p.email, '@', 1)), ''), 'Your partner')
    INTO sender_name
    FROM public.profiles p WHERE p.id = NEW.user_id;
  sender_name := COALESCE(NULLIF(btrim(sender_name), ''), 'Your partner');

  SELECT name INTO subj_name FROM public.subjects WHERE id = subj_id;

  variant := (floor(random() * 5))::int;
  IF variant = 0 THEN
    msg_title := sender_name || ' finished ' || COALESCE(subj_name, 'a subject') || ' 100% 🏆';
    msg_body  := 'Order some chocolates for them 🍫';
  ELSIF variant = 1 THEN
    msg_title := sender_name || ' just wrapped ' || COALESCE(subj_name, 'a subject') || '! 🎉';
    msg_body  := 'Every topic ticked. Time to celebrate 🍕';
  ELSIF variant = 2 THEN
    msg_title := sender_name || ' conquered ' || COALESCE(subj_name, 'a subject') || ' ✅';
    msg_body  := 'Coffee is on you today ☕';
  ELSIF variant = 3 THEN
    msg_title := 'Full clear! ' || sender_name || ' → ' || COALESCE(subj_name, 'a subject');
    msg_body  := 'Send a high-five and maybe an ice cream 🍦';
  ELSE
    msg_title := sender_name || ' aced every topic in ' || COALESCE(subj_name, 'a subject') || ' 🌟';
    msg_body  := 'They earned a treat — your move 🎁';
  END IF;

  FOR other_user_id IN
    SELECT partner_id FROM public.study_partners WHERE user_id = NEW.user_id
    UNION
    SELECT user_id FROM public.study_partners WHERE partner_id = NEW.user_id
  LOOP
    INSERT INTO public.notification_queue (user_id, kind, title, body, url, data)
    VALUES (
      other_user_id,
      'subject_complete',
      msg_title,
      msg_body,
      '/subjects/' || subj_id::text,
      jsonb_build_object('from', NEW.user_id, 'by_user', NEW.user_id, 'subject_id', subj_id, 'subject_name', subj_name)
    );
  END LOOP;

  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_subject_complete_notify ON public.topic_progress;
CREATE TRIGGER trg_subject_complete_notify
AFTER INSERT OR UPDATE ON public.topic_progress
FOR EACH ROW EXECUTE FUNCTION public.queue_subject_complete_notification();