
-- 1. Study partners table (mutual: both directions stored)
CREATE TABLE IF NOT EXISTS public.study_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, partner_id),
  CHECK (user_id <> partner_id)
);

GRANT SELECT, INSERT, DELETE ON public.study_partners TO authenticated;
GRANT ALL ON public.study_partners TO service_role;

ALTER TABLE public.study_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view own partner rows" ON public.study_partners
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR auth.uid() = partner_id);
CREATE POLICY "insert own partner rows" ON public.study_partners
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete own partner rows" ON public.study_partners
  FOR DELETE TO authenticated USING (auth.uid() = user_id OR auth.uid() = partner_id);

-- 2. Helper: is_partner_of (security definer to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_partner_of(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.study_partners
    WHERE (user_id = _a AND partner_id = _b)
       OR (user_id = _b AND partner_id = _a)
  );
$$;

-- 3. Widen profiles SELECT to self OR partner
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users view own or partner profile" ON public.profiles;
CREATE POLICY "Users view own or partner profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.is_partner_of(auth.uid(), id));

-- 4. Widen topic_progress SELECT to self OR partner
DROP POLICY IF EXISTS "Users can view their own progress" ON public.topic_progress;
DROP POLICY IF EXISTS "Users view own or partner progress" ON public.topic_progress;
CREATE POLICY "Users view own or partner progress" ON public.topic_progress
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_partner_of(auth.uid(), user_id));

-- 5. Lookup helper by email (definer; returns minimal info)
CREATE OR REPLACE FUNCTION public.find_profile_by_email(p_email text)
RETURNS TABLE (id uuid, name text, email text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.name, p.email, p.avatar_url
  FROM public.profiles p
  WHERE lower(p.email) = lower(trim(p_email))
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.find_profile_by_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_profile_by_email(text) TO authenticated;

-- 6. Add partnership by email (mutual)
CREATE OR REPLACE FUNCTION public.add_study_partner_by_email(p_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  target uuid;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT id INTO target FROM public.profiles WHERE lower(email) = lower(trim(p_email)) LIMIT 1;
  IF target IS NULL THEN RAISE EXCEPTION 'user_not_found'; END IF;
  IF target = me THEN RAISE EXCEPTION 'cannot_partner_self'; END IF;
  INSERT INTO public.study_partners(user_id, partner_id) VALUES (me, target)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.study_partners(user_id, partner_id) VALUES (target, me)
    ON CONFLICT DO NOTHING;
  RETURN target;
END;
$$;
REVOKE ALL ON FUNCTION public.add_study_partner_by_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_study_partner_by_email(text) TO authenticated;

-- 7. Remove partnership (both directions)
CREATE OR REPLACE FUNCTION public.remove_study_partner(p_partner_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  DELETE FROM public.study_partners
   WHERE (user_id = me AND partner_id = p_partner_id)
      OR (user_id = p_partner_id AND partner_id = me);
END;
$$;
REVOKE ALL ON FUNCTION public.remove_study_partner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_study_partner(uuid) TO authenticated;
