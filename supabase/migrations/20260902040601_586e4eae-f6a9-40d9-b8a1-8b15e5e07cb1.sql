
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
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT countdown_label, countdown_date INTO v_label, v_date FROM public.profiles WHERE id = v_me;

  UPDATE public.profiles
     SET countdown_sync = p_on,
         countdown_updated_at = now()
   WHERE id = v_me;

  IF p_on THEN
    UPDATE public.profiles p
       SET countdown_sync = true,
           countdown_label = COALESCE(v_label, p.countdown_label),
           countdown_date  = COALESCE(v_date, p.countdown_date),
           countdown_updated_at = now()
     WHERE p.id IN (
       SELECT sp.partner_id FROM public.study_partners sp WHERE sp.user_id = v_me
       UNION
       SELECT sp.user_id FROM public.study_partners sp WHERE sp.partner_id = v_me
     );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_countdown(p_label text, p_date timestamptz)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_sync boolean;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  UPDATE public.profiles
     SET countdown_label = p_label,
         countdown_date = p_date,
         countdown_updated_at = now()
   WHERE id = v_me
   RETURNING countdown_sync INTO v_sync;

  IF COALESCE(v_sync, false) THEN
    UPDATE public.profiles p
       SET countdown_label = p_label,
           countdown_date = p_date,
           countdown_sync = true,
           countdown_updated_at = now()
     WHERE p.id IN (
       SELECT sp.partner_id FROM public.study_partners sp WHERE sp.user_id = v_me
       UNION
       SELECT sp.user_id FROM public.study_partners sp WHERE sp.partner_id = v_me
     );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_countdown_sync(boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_countdown(text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_countdown_sync(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_countdown(text, timestamptz) TO authenticated;
