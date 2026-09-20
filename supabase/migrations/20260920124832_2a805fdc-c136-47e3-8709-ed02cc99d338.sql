
CREATE TABLE IF NOT EXISTS public.rate_limits (
  user_id uuid NOT NULL,
  bucket text NOT NULL,
  window_start timestamptz NOT NULL,
  hits integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, bucket, window_start)
);

GRANT ALL ON public.rate_limits TO service_role;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
-- no policies: only reachable through the security-definer function below

CREATE INDEX IF NOT EXISTS rate_limits_window_idx ON public.rate_limits (window_start);

CREATE OR REPLACE FUNCTION public.check_rate_limit(p_bucket text, p_limit integer, p_window_seconds integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_window timestamptz;
  v_hits integer;
  v_limit integer := least(greatest(coalesce(p_limit, 30), 1), 1000);
  v_win integer := least(greatest(coalesce(p_window_seconds, 3600), 10), 86400);
BEGIN
  IF v_user IS NULL THEN
    RETURN false;
  END IF;
  IF p_bucket IS NULL OR length(p_bucket) > 40 OR p_bucket !~ '^[a-z0-9_\-]+$' THEN
    RETURN false;
  END IF;

  v_window := to_timestamp(floor(extract(epoch from now()) / v_win) * v_win);

  INSERT INTO public.rate_limits (user_id, bucket, window_start, hits)
  VALUES (v_user, p_bucket, v_window, 1)
  ON CONFLICT (user_id, bucket, window_start)
  DO UPDATE SET hits = public.rate_limits.hits + 1
  RETURNING hits INTO v_hits;

  RETURN v_hits <= v_limit;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) TO authenticated;
