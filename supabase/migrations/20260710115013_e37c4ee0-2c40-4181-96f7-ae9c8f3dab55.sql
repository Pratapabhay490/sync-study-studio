
-- 1) Partner profile visibility
DROP POLICY IF EXISTS "Partners can view each other profile" ON public.profiles;
CREATE POLICY "Partners can view each other profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_partner_of(auth.uid(), id));

-- 2) Consolidate overlapping SELECT policies on topic_progress
DROP POLICY IF EXISTS "Users view own progress" ON public.topic_progress;
DROP POLICY IF EXISTS "Users view own or partner progress" ON public.topic_progress;
CREATE POLICY "Users view own or partner progress"
ON public.topic_progress
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_partner_of(auth.uid(), user_id)
);

-- 3) Revoke EXECUTE on internal trigger-only SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.queue_topic_complete_notification() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.queue_poke_notification() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
