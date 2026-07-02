
DROP POLICY IF EXISTS "Creators update own topics" ON public.topics;
DROP POLICY IF EXISTS "Creators delete own topics" ON public.topics;

CREATE POLICY "Partners update topics" ON public.topics
  FOR UPDATE TO authenticated
  USING (added_by IS NULL OR added_by = auth.uid() OR public.is_partner_of(auth.uid(), added_by))
  WITH CHECK (added_by IS NULL OR added_by = auth.uid() OR public.is_partner_of(auth.uid(), added_by));

CREATE POLICY "Partners delete topics" ON public.topics
  FOR DELETE TO authenticated
  USING (added_by IS NULL OR added_by = auth.uid() OR public.is_partner_of(auth.uid(), added_by));

DROP POLICY IF EXISTS "Creators update own subjects" ON public.subjects;
DROP POLICY IF EXISTS "Creators delete own subjects" ON public.subjects;

CREATE POLICY "Partners update subjects" ON public.subjects
  FOR UPDATE TO authenticated
  USING (created_by IS NULL OR created_by = auth.uid() OR public.is_partner_of(auth.uid(), created_by))
  WITH CHECK (created_by IS NULL OR created_by = auth.uid() OR public.is_partner_of(auth.uid(), created_by));

CREATE POLICY "Partners delete subjects" ON public.subjects
  FOR DELETE TO authenticated
  USING (created_by IS NULL OR created_by = auth.uid() OR public.is_partner_of(auth.uid(), created_by));
