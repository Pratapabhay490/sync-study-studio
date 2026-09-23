CREATE TABLE IF NOT EXISTS public.partner_merge_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keeper_id uuid NOT NULL,
  absorbed_id uuid NOT NULL,
  subjects_moved integer NOT NULL DEFAULT 0,
  topics_moved integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  reverted_at timestamptz
);
GRANT ALL ON public.partner_merge_log TO service_role;
ALTER TABLE public.partner_merge_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "merge log visible to participants" ON public.partner_merge_log;
CREATE POLICY "merge log visible to participants" ON public.partner_merge_log
  FOR SELECT TO authenticated USING (keeper_id = auth.uid() OR absorbed_id = auth.uid());
GRANT SELECT ON public.partner_merge_log TO authenticated;

-- Safer merge: keeper is the account with the most study history.
CREATE OR REPLACE FUNCTION public.link_study_partners(a uuid, b uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  keeper uuid;
  absorbed uuid;
  score_a integer;
  score_b integer;
  age_a timestamptz;
  age_b timestamptz;
  s_mine RECORD;
  s_theirs_id uuid;
  t_mine RECORD;
  n_subjects integer := 0;
  n_topics integer := 0;
BEGIN
  IF a IS NULL OR b IS NULL OR a = b THEN RAISE EXCEPTION 'invalid_pair'; END IF;

  -- one partner per account
  IF EXISTS (SELECT 1 FROM public.study_partners
              WHERE (user_id = a AND partner_id <> b) OR (partner_id = a AND user_id <> b)) THEN
    RAISE EXCEPTION 'already_has_partner';
  END IF;
  IF EXISTS (SELECT 1 FROM public.study_partners
              WHERE (user_id = b AND partner_id <> a) OR (partner_id = b AND user_id <> a)) THEN
    RAISE EXCEPTION 'partner_already_has_partner';
  END IF;

  SELECT count(*) INTO score_a FROM public.topic_progress WHERE user_id = a;
  SELECT count(*) INTO score_b FROM public.topic_progress WHERE user_id = b;
  SELECT created_at INTO age_a FROM public.profiles WHERE id = a;
  SELECT created_at INTO age_b FROM public.profiles WHERE id = b;

  IF score_a > score_b OR (score_a = score_b AND COALESCE(age_a, now()) <= COALESCE(age_b, now())) THEN
    keeper := a; absorbed := b;
  ELSE
    keeper := b; absorbed := a;
  END IF;

  INSERT INTO public.study_partners(user_id, partner_id) VALUES (a, b) ON CONFLICT DO NOTHING;
  INSERT INTO public.study_partners(user_id, partner_id) VALUES (b, a) ON CONFLICT DO NOTHING;

  FOR s_mine IN SELECT id, name FROM public.subjects WHERE owner_id = keeper LOOP
    FOR s_theirs_id IN
      SELECT id FROM public.subjects WHERE owner_id = absorbed AND lower(name) = lower(s_mine.name)
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
      GET DIAGNOSTICS n_topics = ROW_COUNT;
      DELETE FROM public.subjects WHERE id = s_theirs_id;
      n_subjects := n_subjects + 1;
    END LOOP;
  END LOOP;

  INSERT INTO public.partner_merge_log(keeper_id, absorbed_id, subjects_moved, topics_moved)
  VALUES (keeper, absorbed, n_subjects, n_topics);
END;
$function$;

-- Unlinking gives the partner their own full copy back instead of an empty account.
CREATE OR REPLACE FUNCTION public.remove_study_partner(p_partner_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  me uuid := auth.uid();
  keeper uuid;
  leaver uuid;
  cnt_me integer;
  cnt_them integer;
  s RECORD;
  t RECORD;
  new_s uuid;
  new_t uuid;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_partner_id IS NULL OR p_partner_id = me THEN RAISE EXCEPTION 'invalid_pair'; END IF;

  SELECT count(*) INTO cnt_me FROM public.subjects WHERE owner_id = me;
  SELECT count(*) INTO cnt_them FROM public.subjects WHERE owner_id = p_partner_id;

  IF cnt_me > 0 AND cnt_them = 0 THEN
    keeper := me; leaver := p_partner_id;
  ELSIF cnt_them > 0 AND cnt_me = 0 THEN
    keeper := p_partner_id; leaver := me;
  END IF;

  IF keeper IS NOT NULL THEN
    FOR s IN SELECT id, name, icon FROM public.subjects WHERE owner_id = keeper LOOP
      INSERT INTO public.subjects(name, icon, owner_id, created_by)
      VALUES (s.name, s.icon, leaver, leaver)
      RETURNING id INTO new_s;

      FOR t IN SELECT id, topic_name, description FROM public.topics WHERE subject_id = s.id LOOP
        INSERT INTO public.topics(subject_id, topic_name, description, owner_id, added_by)
        VALUES (new_s, t.topic_name, t.description, leaver, leaver)
        RETURNING id INTO new_t;

        UPDATE public.topic_progress
           SET topic_id = new_t
         WHERE topic_id = t.id AND user_id = leaver;
      END LOOP;
    END LOOP;

    UPDATE public.partner_merge_log
       SET reverted_at = now()
     WHERE reverted_at IS NULL
       AND ((keeper_id = keeper AND absorbed_id = leaver) OR (keeper_id = leaver AND absorbed_id = keeper));
  END IF;

  DELETE FROM public.study_partners
   WHERE (user_id = me AND partner_id = p_partner_id)
      OR (user_id = p_partner_id AND partner_id = me);

  UPDATE public.partner_invites SET status = 'cancelled', responded_at = now()
   WHERE status = 'pending'
     AND ((from_user = me AND to_user = p_partner_id) OR (from_user = p_partner_id AND to_user = me));
END;
$function$;

-- Refuse a second partner at invite time too, and ignore stale invites.
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
  IF EXISTS (SELECT 1 FROM public.study_partners WHERE user_id = me) THEN
    RAISE EXCEPTION 'already_has_partner';
  END IF;
  IF EXISTS (SELECT 1 FROM public.study_partners WHERE user_id = target) THEN
    RAISE EXCEPTION 'partner_already_has_partner';
  END IF;

  SELECT id INTO existing FROM public.partner_invites
   WHERE from_user = target AND to_user = me AND status = 'pending'
     AND created_at > now() - interval '7 days' LIMIT 1;
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

-- Expired invites can no longer be accepted.
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
  IF rec.created_at < now() - interval '7 days' THEN
    UPDATE public.partner_invites SET status = 'cancelled', responded_at = now() WHERE id = p_id;
    RAISE EXCEPTION 'invite_expired';
  END IF;

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

REVOKE ALL ON FUNCTION public.link_study_partners(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_study_partner(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.send_partner_invite(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_partner_invite(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_study_partner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_partner_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_partner_invite(uuid) TO authenticated;