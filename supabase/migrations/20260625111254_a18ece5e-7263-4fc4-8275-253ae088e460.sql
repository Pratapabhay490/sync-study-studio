
-- 1. Profiles: drop partner-visible policy that leaks email; expose safe partner data via RPC
DROP POLICY IF EXISTS "Users view own or partner profile" ON public.profiles;

CREATE OR REPLACE FUNCTION public.list_visible_profiles()
RETURNS TABLE(id uuid, name text, email text, avatar_url text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.name,
         CASE WHEN p.id = auth.uid() THEN p.email ELSE NULL END AS email,
         p.avatar_url, p.created_at
  FROM public.profiles p
  WHERE p.id = auth.uid()
     OR public.is_partner_of(auth.uid(), p.id)
  ORDER BY p.created_at;
$$;
REVOKE ALL ON FUNCTION public.list_visible_profiles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_visible_profiles() TO authenticated;

-- 2. Restrict pokes policies to authenticated role
DROP POLICY IF EXISTS "pokes viewable by sender or receiver" ON public.pokes;
DROP POLICY IF EXISTS "receiver marks read" ON public.pokes;
DROP POLICY IF EXISTS "users send pokes as themselves" ON public.pokes;

CREATE POLICY "pokes viewable by sender or receiver" ON public.pokes
  FOR SELECT TO authenticated
  USING (auth.uid() = from_user OR auth.uid() = to_user);
CREATE POLICY "receiver marks read" ON public.pokes
  FOR UPDATE TO authenticated
  USING (auth.uid() = to_user);
CREATE POLICY "users send pokes as themselves" ON public.pokes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = from_user);

-- 3. Restrict notification_queue SELECT to authenticated
DROP POLICY IF EXISTS "users see own queued" ON public.notification_queue;
CREATE POLICY "users see own queued" ON public.notification_queue
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 4. Restrict push_subscriptions ALL to authenticated
DROP POLICY IF EXISTS "users manage own subs" ON public.push_subscriptions;
CREATE POLICY "users manage own subs" ON public.push_subscriptions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. Lock down SECURITY DEFINER functions: revoke from public/anon; grant only what's needed
-- Trigger functions: revoke all execute (only fired by triggers, not via API)
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.queue_poke_notification() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.queue_topic_complete_notification() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- Helper used inside RLS policies: needed for authenticated, not for anon
REVOKE ALL ON FUNCTION public.is_partner_of(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_partner_of(uuid, uuid) TO authenticated;

-- RPCs called by signed-in users only
REVOKE ALL ON FUNCTION public.add_study_partner_by_email(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_study_partner_by_email(text) TO authenticated;

REVOKE ALL ON FUNCTION public.remove_study_partner(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_study_partner(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.find_profile_by_email(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_profile_by_email(text) TO authenticated;
