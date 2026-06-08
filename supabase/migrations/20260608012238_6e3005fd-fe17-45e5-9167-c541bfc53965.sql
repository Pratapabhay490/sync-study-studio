GRANT DELETE ON public.profiles TO authenticated;
CREATE POLICY "Authenticated can delete profiles" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);