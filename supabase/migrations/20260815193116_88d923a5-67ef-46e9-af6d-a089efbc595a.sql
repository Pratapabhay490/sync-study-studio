-- 1. Retention cleanup (analytics-safe: no quiz_* , user_xp_events, user_badges, topic_progress touched)
CREATE OR REPLACE FUNCTION public.cleanup_old_records()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n_notifications int := 0;
  n_pokes int := 0;
  n_reactions int := 0;
  n_focus int := 0;
BEGIN
  DELETE FROM public.notification_queue
   WHERE processed = true AND created_at < now() - interval '30 days';
  GET DIAGNOSTICS n_notifications = ROW_COUNT;

  DELETE FROM public.pokes WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS n_pokes = ROW_COUNT;

  DELETE FROM public.reactions WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS n_reactions = ROW_COUNT;

  DELETE FROM public.focus_sessions
   WHERE state <> 'active' AND ends_at < now() - interval '180 days';
  GET DIAGNOSTICS n_focus = ROW_COUNT;

  RETURN jsonb_build_object(
    'notifications', n_notifications,
    'pokes', n_pokes,
    'reactions', n_reactions,
    'focus_sessions', n_focus,
    'ran_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_old_records() FROM PUBLIC, anon, authenticated;

-- 2. Storage / usage report
CREATE OR REPLACE FUNCTION public.db_usage_report()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_bytes bigint;
  tables jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT pg_database_size(current_database()) INTO total_bytes;

  SELECT coalesce(jsonb_agg(t ORDER BY (t->>'bytes')::bigint DESC), '[]'::jsonb)
    INTO tables
  FROM (
    SELECT jsonb_build_object(
             'table', c.relname,
             'bytes', pg_total_relation_size(c.oid),
             'rows', greatest(c.reltuples::bigint, 0)
           ) AS t
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY pg_total_relation_size(c.oid) DESC
    LIMIT 12
  ) s;

  RETURN jsonb_build_object(
    'total_bytes', total_bytes,
    'limit_bytes', 500 * 1024 * 1024,
    'percent_used', round((total_bytes::numeric / (500 * 1024 * 1024)) * 100, 1),
    'tables', tables,
    'generated_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.db_usage_report() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.db_usage_report() TO authenticated;

-- 3. Nightly cleanup schedule (22:00 UTC = 03:30 IST)
DO $$
DECLARE jid bigint;
BEGIN
  FOR jid IN SELECT jobid FROM cron.job WHERE jobname = 'lbis-retention-cleanup' LOOP
    PERFORM cron.unschedule(jid);
  END LOOP;
  PERFORM cron.schedule('lbis-retention-cleanup', '0 22 * * *', $c$SELECT public.cleanup_old_records();$c$);
END $$;