REVOKE EXECUTE ON FUNCTION public.ensure_weekly_challenge() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_weekly_challenge() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_weekly_challenge() TO service_role;
REVOKE EXECUTE ON FUNCTION public.refresh_together_streak() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refresh_together_streak() TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_together_streak() TO service_role;