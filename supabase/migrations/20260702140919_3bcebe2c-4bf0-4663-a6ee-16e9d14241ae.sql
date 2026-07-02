
DROP POLICY IF EXISTS "Partners update subjects" ON public.subjects;
DROP POLICY IF EXISTS "Partners delete subjects" ON public.subjects;
DROP POLICY IF EXISTS "Partners update topics" ON public.topics;
DROP POLICY IF EXISTS "Partners delete topics" ON public.topics;

CREATE POLICY "Any authenticated can update subjects" ON public.subjects
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Any authenticated can delete subjects" ON public.subjects
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Any authenticated can update topics" ON public.topics
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Any authenticated can delete topics" ON public.topics
  FOR DELETE TO authenticated USING (true);
