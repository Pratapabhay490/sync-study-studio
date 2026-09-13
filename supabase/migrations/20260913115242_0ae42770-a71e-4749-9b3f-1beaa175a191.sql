CREATE OR REPLACE FUNCTION public.set_countdown_sync(p_on boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_label text;
  v_date timestamptz;
  v_p_label text;
  v_p_date timestamptz;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT countdown_label, countdown_date INTO v_label, v_date FROM public.profiles WHERE id = v_me;

  IF p_on THEN
    -- Prefer an existing partner countdown so enabling sync never wipes
    -- a date the partner intentionally set.
    SELECT p.countdown_label, p.countdown_date INTO v_p_label, v_p_date
      FROM public.profiles p
     WHERE p.countdown_date IS NOT NULL
       AND p.id IN (
         SELECT sp.partner_id FROM public.study_partners sp WHERE sp.user_id = v_me
         UNION
         SELECT sp.user_id FROM public.study_partners sp WHERE sp.partner_id = v_me
       )
     ORDER BY p.countdown_updated_at DESC NULLS LAST
     LIMIT 1;

    IF v_p_date IS NOT NULL THEN
      v_label := v_p_label;
      v_date  := v_p_date;
    END IF;
  END IF;

  UPDATE public.profiles
     SET countdown_sync = p_on,
         countdown_label = CASE WHEN p_on THEN COALESCE(v_label, countdown_label) ELSE countdown_label END,
         countdown_date  = CASE WHEN p_on THEN COALESCE(v_date, countdown_date) ELSE countdown_date END,
         countdown_updated_at = now()
   WHERE id = v_me;

  UPDATE public.profiles p
     SET countdown_sync = p_on,
         countdown_label = CASE WHEN p_on THEN COALESCE(v_label, p.countdown_label) ELSE p.countdown_label END,
         countdown_date  = CASE WHEN p_on THEN COALESCE(v_date, p.countdown_date) ELSE p.countdown_date END,
         countdown_updated_at = now()
   WHERE p.id IN (
     SELECT sp.partner_id FROM public.study_partners sp WHERE sp.user_id = v_me
     UNION
     SELECT sp.user_id FROM public.study_partners sp WHERE sp.partner_id = v_me
   );
END;
$$;

REVOKE ALL ON FUNCTION public.set_countdown_sync(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_countdown_sync(boolean) TO authenticated;