DO $$
DECLARE definition text;
BEGIN
  SELECT pg_get_functiondef('public.reset_own_study_progress(text)'::regprocedure) INTO definition;
  definition := replace(definition, '  DELETE FROM public.user_xp_totals WHERE user_id = v_me;', '  -- XP totals are derived from events; deleting events resets the view.');
  EXECUTE definition;
  SELECT pg_get_functiondef('public.prepare_own_account_deletion(uuid,text)'::regprocedure) INTO definition;
  definition := replace(definition, '  DELETE FROM public.user_xp_totals WHERE user_id = p_user_id;', '  -- XP totals are derived from events and contain no stored personal rows.');
  EXECUTE definition;
END $$;