
-- Make sure we don't double-schedule on re-run
DO $$
DECLARE jid bigint;
BEGIN
  FOR jid IN SELECT jobid FROM cron.job WHERE jobname IN ('lbis-send-push','lbis-motivation') LOOP
    PERFORM cron.unschedule(jid);
  END LOOP;
END $$;

-- Drain notification queue every minute
SELECT cron.schedule(
  'lbis-send-push',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://ohiudeaxangdgpqpyoqx.supabase.co/functions/v1/send-push',
    headers:=jsonb_build_object('Content-Type','application/json'),
    body:='{}'::jsonb
  );
  $$
);

-- 5x per day motivational push
SELECT cron.schedule(
  'lbis-motivation',
  '30 2,6,10,14,16 * * *', -- 08:00, 12:00, 16:00, 20:00, 22:00 IST (UTC -5:30)
  $$
  SELECT net.http_post(
    url:='https://ohiudeaxangdgpqpyoqx.supabase.co/functions/v1/schedule-motivation',
    headers:=jsonb_build_object('Content-Type','application/json'),
    body:='{}'::jsonb
  );
  $$
);
