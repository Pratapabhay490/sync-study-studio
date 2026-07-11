-- Trigger functions: only fired by table triggers, not meant to be called by users
REVOKE ALL ON FUNCTION public.queue_topic_complete_notification() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.queue_poke_notification() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Helper used only inside RLS policies (runs as definer within policy evaluation)
REVOKE ALL ON FUNCTION public.is_partner_of(uuid, uuid) FROM PUBLIC, anon, authenticated;