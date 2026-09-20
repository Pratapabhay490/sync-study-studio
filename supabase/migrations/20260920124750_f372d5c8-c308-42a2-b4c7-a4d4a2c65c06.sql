
-- 1. Tighten quiz insert policies to require session membership
DROP POLICY IF EXISTS "ans insert self" ON public.quiz_answers;
CREATE POLICY "ans insert self" ON public.quiz_answers
FOR INSERT TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.quiz_sessions s
    WHERE s.id = quiz_answers.session_id
      AND (s.host_id = (SELECT auth.uid()) OR s.partner_id = (SELECT auth.uid()))
  )
);

DROP POLICY IF EXISTS "players insert self" ON public.quiz_session_players;
CREATE POLICY "players insert self" ON public.quiz_session_players
FOR INSERT TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.quiz_sessions s
    WHERE s.id = quiz_session_players.session_id
      AND (s.host_id = (SELECT auth.uid()) OR s.partner_id = (SELECT auth.uid()))
  )
);

-- 2. Revoke anonymous execute on security-definer functions
REVOKE EXECUTE ON FUNCTION public.claim_weekly_challenge(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.end_focus_session(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.heartbeat_presence(text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_partner_of(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.join_focus_session(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.my_partner_id() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.queue_checkin_partner_summary() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.queue_reaction_notification() FROM anon, public;

-- keep the ones the signed-in app actually calls
GRANT EXECUTE ON FUNCTION public.claim_weekly_challenge(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_focus_session(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.heartbeat_presence(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_partner_of(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_focus_session(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_partner_id() TO authenticated;
