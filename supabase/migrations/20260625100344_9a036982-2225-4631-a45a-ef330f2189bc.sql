
-- Profile delete: only owner can delete their own profile
DROP POLICY IF EXISTS "Authenticated can delete profiles" ON public.profiles;
CREATE POLICY "Users can delete own profile" ON public.profiles
  FOR DELETE TO authenticated USING (auth.uid() = id);

-- Profiles SELECT: own row only (email no longer enumerable)
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

-- topic_progress SELECT: own rows only
DROP POLICY IF EXISTS "Progress viewable by authenticated" ON public.topic_progress;
CREATE POLICY "Users view own progress" ON public.topic_progress
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Subjects: scope mutations to creator
DROP POLICY IF EXISTS "Authenticated can insert subjects" ON public.subjects;
DROP POLICY IF EXISTS "Authenticated can update subjects" ON public.subjects;
DROP POLICY IF EXISTS "Authenticated can delete subjects" ON public.subjects;
CREATE POLICY "Users insert own subjects" ON public.subjects
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creators update own subjects" ON public.subjects
  FOR UPDATE TO authenticated USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creators delete own subjects" ON public.subjects
  FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- Topics: scope mutations to creator
DROP POLICY IF EXISTS "Authenticated can insert topics" ON public.topics;
DROP POLICY IF EXISTS "Authenticated can update topics" ON public.topics;
DROP POLICY IF EXISTS "Authenticated can delete topics" ON public.topics;
CREATE POLICY "Users insert own topics" ON public.topics
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = added_by);
CREATE POLICY "Creators update own topics" ON public.topics
  FOR UPDATE TO authenticated USING (auth.uid() = added_by) WITH CHECK (auth.uid() = added_by);
CREATE POLICY "Creators delete own topics" ON public.topics
  FOR DELETE TO authenticated USING (auth.uid() = added_by);
