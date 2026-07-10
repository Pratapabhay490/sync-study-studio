
-- 1. Template tables
CREATE TABLE IF NOT EXISTS public.subject_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  icon text,
  order_index int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subject_templates TO authenticated;
GRANT ALL ON public.subject_templates TO service_role;
ALTER TABLE public.subject_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read subject templates" ON public.subject_templates;
CREATE POLICY "Read subject templates" ON public.subject_templates
  FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.topic_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_template_id uuid NOT NULL REFERENCES public.subject_templates(id) ON DELETE CASCADE,
  topic_name text NOT NULL,
  description text,
  order_index int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.topic_templates TO authenticated;
GRANT ALL ON public.topic_templates TO service_role;
ALTER TABLE public.topic_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read topic templates" ON public.topic_templates;
CREATE POLICY "Read topic templates" ON public.topic_templates
  FOR SELECT TO authenticated USING (true);

-- 2. Seed template tables from currently preloaded (owner-less) subjects & topics
INSERT INTO public.subject_templates (slug, name, icon, order_index)
SELECT lower(regexp_replace(s.name, '[^a-zA-Z0-9]+', '-', 'g')),
       s.name,
       s.icon,
       (row_number() OVER (ORDER BY s.name))::int
FROM public.subjects s
WHERE s.created_by IS NULL
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.topic_templates (subject_template_id, topic_name, description, order_index)
SELECT st.id, t.topic_name, t.description,
       (row_number() OVER (PARTITION BY st.id ORDER BY t.created_at))::int
FROM public.topics t
JOIN public.subjects s ON s.id = t.subject_id
JOIN public.subject_templates st ON st.name = s.name
WHERE s.created_by IS NULL;

-- 3. Add owner_id columns
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.topics   ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- 4. Backfill: assign existing rows to earliest user (their partner still sees them via partnership)
WITH first_user AS (SELECT id FROM public.profiles ORDER BY created_at LIMIT 1)
UPDATE public.subjects SET owner_id = (SELECT id FROM first_user)
 WHERE owner_id IS NULL;

UPDATE public.topics t
   SET owner_id = s.owner_id
  FROM public.subjects s
 WHERE t.subject_id = s.id AND t.owner_id IS NULL;

-- 5. Enforce owner_id going forward
ALTER TABLE public.subjects ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE public.topics   ALTER COLUMN owner_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS subjects_owner_idx ON public.subjects(owner_id);
CREATE INDEX IF NOT EXISTS topics_owner_idx   ON public.topics(owner_id);

-- 6. Replace RLS policies with owner-or-partner rules
DROP POLICY IF EXISTS "Subjects viewable by authenticated" ON public.subjects;
DROP POLICY IF EXISTS "Users insert own subjects" ON public.subjects;
DROP POLICY IF EXISTS "Any authenticated can update subjects" ON public.subjects;
DROP POLICY IF EXISTS "Any authenticated can delete subjects" ON public.subjects;
DROP POLICY IF EXISTS "Partners update subjects" ON public.subjects;
DROP POLICY IF EXISTS "Partners delete subjects" ON public.subjects;

CREATE POLICY "Owner or partner view subjects" ON public.subjects
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_partner_of(auth.uid(), owner_id));
CREATE POLICY "Insert own subjects" ON public.subjects
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owner or partner update subjects" ON public.subjects
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.is_partner_of(auth.uid(), owner_id))
  WITH CHECK (owner_id = auth.uid() OR public.is_partner_of(auth.uid(), owner_id));
CREATE POLICY "Owner or partner delete subjects" ON public.subjects
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.is_partner_of(auth.uid(), owner_id));

DROP POLICY IF EXISTS "Topics viewable by authenticated" ON public.topics;
DROP POLICY IF EXISTS "Users insert own topics" ON public.topics;
DROP POLICY IF EXISTS "Any authenticated can update topics" ON public.topics;
DROP POLICY IF EXISTS "Any authenticated can delete topics" ON public.topics;
DROP POLICY IF EXISTS "Partners update topics" ON public.topics;
DROP POLICY IF EXISTS "Partners delete topics" ON public.topics;

CREATE POLICY "Owner or partner view topics" ON public.topics
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_partner_of(auth.uid(), owner_id));
CREATE POLICY "Insert own topics" ON public.topics
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owner or partner update topics" ON public.topics
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.is_partner_of(auth.uid(), owner_id))
  WITH CHECK (owner_id = auth.uid() OR public.is_partner_of(auth.uid(), owner_id));
CREATE POLICY "Owner or partner delete topics" ON public.topics
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.is_partner_of(auth.uid(), owner_id));

-- 7. Seed templates for every new user on sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  tmpl RECORD;
  new_subj_id uuid;
BEGIN
  INSERT INTO public.profiles (id, name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  FOR tmpl IN SELECT * FROM public.subject_templates ORDER BY order_index, name LOOP
    INSERT INTO public.subjects (name, icon, owner_id, created_by)
    VALUES (tmpl.name, tmpl.icon, NEW.id, NEW.id)
    RETURNING id INTO new_subj_id;

    INSERT INTO public.topics (subject_id, topic_name, description, owner_id, added_by)
    SELECT new_subj_id, tt.topic_name, tt.description, NEW.id, NEW.id
    FROM public.topic_templates tt
    WHERE tt.subject_template_id = tmpl.id
    ORDER BY tt.order_index;
  END LOOP;

  RETURN NEW;
END; $function$;

-- 8. On partner add, merge duplicate subjects/topics by name; preserve progress on both sides
CREATE OR REPLACE FUNCTION public.add_study_partner_by_email(p_email text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  me uuid := auth.uid();
  target uuid;
  s_mine RECORD;
  s_theirs_id uuid;
  t_mine RECORD;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT id INTO target FROM public.profiles WHERE lower(email) = lower(trim(p_email)) LIMIT 1;
  IF target IS NULL THEN RAISE EXCEPTION 'user_not_found'; END IF;
  IF target = me THEN RAISE EXCEPTION 'cannot_partner_self'; END IF;

  INSERT INTO public.study_partners(user_id, partner_id) VALUES (me, target) ON CONFLICT DO NOTHING;
  INSERT INTO public.study_partners(user_id, partner_id) VALUES (target, me) ON CONFLICT DO NOTHING;

  -- Merge duplicates: for each of my subjects that shares a name with partner's, absorb partner's copy
  FOR s_mine IN SELECT id, name FROM public.subjects WHERE owner_id = me LOOP
    FOR s_theirs_id IN
      SELECT id FROM public.subjects
      WHERE owner_id = target AND lower(name) = lower(s_mine.name)
    LOOP
      -- Merge topics within these two subjects by topic name
      FOR t_mine IN SELECT id, topic_name FROM public.topics WHERE subject_id = s_mine.id LOOP
        -- Move partner's progress on duplicate topics to my topic (skip if already exists)
        UPDATE public.topic_progress tp
           SET topic_id = t_mine.id
         WHERE tp.topic_id IN (
                 SELECT id FROM public.topics
                 WHERE subject_id = s_theirs_id
                   AND lower(topic_name) = lower(t_mine.topic_name)
               )
           AND NOT EXISTS (
                 SELECT 1 FROM public.topic_progress tp2
                 WHERE tp2.topic_id = t_mine.id AND tp2.user_id = tp.user_id
               );
        -- Drop leftover duplicate-progress rows and the duplicate topics
        DELETE FROM public.topic_progress
         WHERE topic_id IN (
                 SELECT id FROM public.topics
                 WHERE subject_id = s_theirs_id
                   AND lower(topic_name) = lower(t_mine.topic_name)
               );
        DELETE FROM public.topics
         WHERE subject_id = s_theirs_id
           AND lower(topic_name) = lower(t_mine.topic_name);
      END LOOP;

      -- Any remaining unique topics under partner's subject get reparented to mine
      UPDATE public.topics SET subject_id = s_mine.id WHERE subject_id = s_theirs_id;

      -- Delete now-empty duplicate partner subject
      DELETE FROM public.subjects WHERE id = s_theirs_id;
    END LOOP;
  END LOOP;

  RETURN target;
END;
$function$;
