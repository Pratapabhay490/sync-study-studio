
-- 1. Scope partner notifications to actual study partners only
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
    SELECT COALESCE(p.name, p.email, 'Your partner') INTO sender_name
      FROM public.profiles p WHERE p.id = NEW.user_id;
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

-- 2. Reschedule pg_cron jobs to include the CRON_SECRET bearer header
DO $$
DECLARE
  base_url text;
  cron_secret text;
  job record;
  auth_header text;
BEGIN
  -- Read project URL + secret from Vault if available; otherwise fall back to known project ref
  BEGIN
    SELECT decrypted_secret INTO cron_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    cron_secret := NULL;
  END;

  base_url := 'https://ohiudeaxangdgpqpyoqx.supabase.co/functions/v1';

  -- Unschedule any existing jobs that point at our two functions
  FOR job IN
    SELECT jobid, jobname FROM cron.job
    WHERE command ILIKE '%/functions/v1/send-push%'
       OR command ILIKE '%/functions/v1/schedule-motivation%'
  LOOP
    PERFORM cron.unschedule(job.jobid);
  END LOOP;

  IF cron_secret IS NULL THEN
    -- Without the secret available in Vault, leave the jobs unscheduled so the
    -- functions cannot be invoked anonymously. Operator must reschedule manually.
    RAISE NOTICE 'CRON_SECRET not in vault; cron jobs left unscheduled. Reschedule with bearer header after adding to vault.';
    RETURN;
  END IF;

  auth_header := 'Bearer ' || cron_secret;

  PERFORM cron.schedule(
    'send-push-every-minute',
    '* * * * *',
    format($cmd$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type','application/json','Authorization', %L),
        body := '{}'::jsonb
      );
    $cmd$, base_url || '/send-push', auth_header)
  );

  PERFORM cron.schedule(
    'schedule-motivation-5x-daily',
    '0 8,12,15,18,21 * * *',
    format($cmd$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type','application/json','Authorization', %L),
        body := '{}'::jsonb
      );
    $cmd$, base_url || '/schedule-motivation', auth_header)
  );
END $$;
