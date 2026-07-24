
-- Rebuild view without auth.users exposure + as security invoker
DROP VIEW IF EXISTS public.user_xp_totals;
CREATE VIEW public.user_xp_totals
WITH (security_invoker = true) AS
  SELECT p.id AS user_id,
         COALESCE(SUM(e.amount), 0)::int AS total_xp,
         public.xp_to_level(COALESCE(SUM(e.amount), 0)::int) AS level
    FROM public.profiles p
    LEFT JOIN public.user_xp_events e ON e.user_id = p.id
   GROUP BY p.id;

GRANT SELECT ON public.user_xp_totals TO authenticated;

-- Lock internal SECURITY DEFINER helpers so only server / triggers use them
REVOKE ALL ON FUNCTION public.award_xp(uuid, text, int, uuid, text, jsonb) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.unlock_badge(uuid, text, jsonb) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.gamify_topic_complete() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.gamify_subject_complete() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.gamify_quiz_answer() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.gamify_quiz_session_finish() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.gamify_focus_end() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.gamify_reaction_sent() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.gamify_checkin() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.gamify_partner_added() FROM public, anon, authenticated;

-- pair_key_for + xp_to_level are pure helpers, safe as INVOKER
ALTER FUNCTION public.pair_key_for(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.xp_to_level(int) SET search_path = public;
