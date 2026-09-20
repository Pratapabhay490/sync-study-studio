
-- internal linking helper (carries the previous merge logic)
CREATE OR REPLACE FUNCTION public.link_study_partners(a uuid, b uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  s_mine RECORD;
  s_theirs_id uuid;
  t_mine RECORD;
BEGIN
  IF a IS NULL OR b IS NULL OR a = b THEN RAISE EXCEPTION 'invalid_pair'; END IF;

  INSERT INTO public.study_partners(user_id, partner_id) VALUES (a, b) ON CONFLICT DO NOTHING;
  INSERT INTO public.study_partners(user_id, partner_id) VALUES (b, a) ON CONFLICT DO NOTHING;

  FOR s_mine IN SELECT id, name FROM public.subjects WHERE owner_id = a LOOP
    FOR s_theirs_id IN
      SELECT id FROM public.subjects WHERE owner_id = b AND lower(name) = lower(s_mine.name)
    LOOP
      FOR t_mine IN SELECT id, topic_name FROM public.topics WHERE subject_id = s_mine.id LOOP
        UPDATE public.topic_progress tp
           SET topic_id = t_mine.id
         WHERE tp.topic_id IN (
                 SELECT id FROM public.topics
                 WHERE subject_id = s_theirs_id AND lower(topic_name) = lower(t_mine.topic_name))
           AND NOT EXISTS (
                 SELECT 1 FROM public.topic_progress tp2
                 WHERE tp2.topic_id = t_mine.id AND tp2.user_id = tp.user_id);
        DELETE FROM public.topic_progress
         WHERE topic_id IN (
                 SELECT id FROM public.topics
                 WHERE subject_id = s_theirs_id AND lower(topic_name) = lower(t_mine.topic_name));
        DELETE FROM public.topics
         WHERE subject_id = s_theirs_id AND lower(topic_name) = lower(t_mine.topic_name);
      END LOOP;
      UPDATE public.topics SET subject_id = s_mine.id WHERE subject_id = s_theirs_id;
      DELETE FROM public.subjects WHERE id = s_theirs_id;
    END LOOP;
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public.link_study_partners(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.partner_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  CONSTRAINT partner_invites_status_chk CHECK (status IN ('pending','accepted','declined','cancelled')),
  CONSTRAINT partner_invites_distinct_chk CHECK (from_user <> to_user)
);

GRANT SELECT ON public.partner_invites TO authenticated;
GRANT ALL ON public.partner_invites TO service_role;

ALTER TABLE public.partner_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invites visible to both sides" ON public.partner_invites;
CREATE POLICY "invites visible to both sides" ON public.partner_invites
  FOR SELECT TO authenticated
  USING (from_user = auth.uid() OR to_user = auth.uid());

CREATE UNIQUE INDEX IF NOT EXISTS partner_invites_pending_uq
  ON public.partner_invites (from_user, to_user) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS partner_invites_to_user_idx ON public.partner_invites (to_user, status, created_at DESC);
CREATE INDEX IF NOT EXISTS partner_invites_from_user_idx ON public.partner_invites (from_user, status, created_at DESC);

-- send invite
CREATE OR REPLACE FUNCTION public.send_partner_invite(p_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  me uuid := auth.uid();
  target uuid;
  existing uuid;
  inv uuid;
  sender_name text;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT id INTO target FROM public.profiles WHERE lower(email) = lower(trim(p_email)) LIMIT 1;
  IF target IS NULL THEN RAISE EXCEPTION 'user_not_found'; END IF;
  IF target = me THEN RAISE EXCEPTION 'cannot_partner_self'; END IF;
  IF EXISTS (SELECT 1 FROM public.study_partners
              WHERE (user_id = me AND partner_id = target) OR (user_id = target AND partner_id = me)) THEN
    RAISE EXCEPTION 'already_partners';
  END IF;

  -- if they already invited me, accept it instead
  SELECT id INTO existing FROM public.partner_invites
   WHERE from_user = target AND to_user = me AND status = 'pending' LIMIT 1;
  IF existing IS NOT NULL THEN
    PERFORM public.accept_partner_invite(existing);
    RETURN existing;
  END IF;

  INSERT INTO public.partner_invites(from_user, to_user)
  VALUES (me, target)
  ON CONFLICT (from_user, to_user) WHERE status = 'pending' DO NOTHING
  RETURNING id INTO inv;

  IF inv IS NULL THEN
    SELECT id INTO inv FROM public.partner_invites
     WHERE from_user = me AND to_user = target AND status = 'pending' LIMIT 1;
    RETURN inv;
  END IF;

  SELECT COALESCE(p.name, p.email, 'Someone') INTO sender_name FROM public.profiles p WHERE p.id = me;
  INSERT INTO public.notification_queue (user_id, kind, title, body, url, data)
  VALUES (target, 'partner_invite', sender_name || ' wants to study with you 🤝',
          'Open settings to accept the study partner invite.', '/settings',
          jsonb_build_object('invite_id', inv, 'from', me));

  RETURN inv;
END;
$function$;

REVOKE ALL ON FUNCTION public.send_partner_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_partner_invite(text) TO authenticated;

-- accept
CREATE OR REPLACE FUNCTION public.accept_partner_invite(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  me uuid := auth.uid();
  rec RECORD;
  who text;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO rec FROM public.partner_invites WHERE id = p_id FOR UPDATE;
  IF rec IS NULL THEN RAISE EXCEPTION 'invite_not_found'; END IF;
  IF rec.to_user <> me THEN RAISE EXCEPTION 'not_your_invite'; END IF;
  IF rec.status <> 'pending' THEN RAISE EXCEPTION 'invite_not_pending'; END IF;

  PERFORM public.link_study_partners(rec.to_user, rec.from_user);

  UPDATE public.partner_invites SET status = 'accepted', responded_at = now() WHERE id = p_id;
  UPDATE public.partner_invites SET status = 'cancelled', responded_at = now()
   WHERE status = 'pending' AND id <> p_id
     AND ((from_user = rec.from_user AND to_user = rec.to_user)
       OR (from_user = rec.to_user AND to_user = rec.from_user));

  SELECT COALESCE(p.name, p.email, 'Your partner') INTO who FROM public.profiles p WHERE p.id = me;
  INSERT INTO public.notification_queue (user_id, kind, title, body, url, data)
  VALUES (rec.from_user, 'partner_invite_accepted', who || ' accepted your invite 🎉',
          'You are now study partners. Time to sync up!', '/dashboard',
          jsonb_build_object('invite_id', p_id, 'partner', me));
END;
$function$;

REVOKE ALL ON FUNCTION public.accept_partner_invite(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_partner_invite(uuid) TO authenticated;

-- decline / cancel
CREATE OR REPLACE FUNCTION public.respond_partner_invite(p_id uuid, p_action text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  me uuid := auth.uid();
  rec RECORD;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_action NOT IN ('declined','cancelled') THEN RAISE EXCEPTION 'invalid_action'; END IF;
  SELECT * INTO rec FROM public.partner_invites WHERE id = p_id FOR UPDATE;
  IF rec IS NULL THEN RAISE EXCEPTION 'invite_not_found'; END IF;
  IF rec.status <> 'pending' THEN RAISE EXCEPTION 'invite_not_pending'; END IF;
  IF p_action = 'declined' AND rec.to_user <> me THEN RAISE EXCEPTION 'not_your_invite'; END IF;
  IF p_action = 'cancelled' AND rec.from_user <> me THEN RAISE EXCEPTION 'not_your_invite'; END IF;

  UPDATE public.partner_invites SET status = p_action, responded_at = now() WHERE id = p_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.respond_partner_invite(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_partner_invite(uuid, text) TO authenticated;

-- old instant-link RPC now routes through invites
CREATE OR REPLACE FUNCTION public.add_study_partner_by_email(p_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN public.send_partner_invite(p_email);
END;
$function$;

REVOKE ALL ON FUNCTION public.add_study_partner_by_email(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_study_partner_by_email(text) TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.partner_invites;
