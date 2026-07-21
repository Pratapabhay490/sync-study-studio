
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

  SELECT count(*) INTO done_topics
    FROM public.topic_progress tp
    JOIN public.topics t ON t.id = tp.topic_id
    WHERE t.subject_id = subj_id AND tp.user_id = NEW.user_id AND tp.completed = true;

  IF done_topics < total_topics THEN RETURN NEW; END IF;

  -- Debounce: don't re-fire if a subject_complete for this user+subject was queued in last 6h
  SELECT count(*) INTO already_sent FROM public.notification_queue
    WHERE kind = 'subject_complete'
      AND data->>'subject_id' = subj_id::text
      AND data->>'by_user' = NEW.user_id::text
      AND created_at > now() - interval '6 hours';
  IF already_sent > 0 THEN RETURN NEW; END IF;

  SELECT COALESCE(p.name, p.email, 'Your partner') INTO sender_name
    FROM public.profiles p WHERE p.id = NEW.user_id;
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

REVOKE EXECUTE ON FUNCTION public.queue_subject_complete_notification() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_subject_complete_notify ON public.topic_progress;
CREATE TRIGGER trg_subject_complete_notify
AFTER INSERT OR UPDATE OF completed ON public.topic_progress
FOR EACH ROW EXECUTE FUNCTION public.queue_subject_complete_notification();
