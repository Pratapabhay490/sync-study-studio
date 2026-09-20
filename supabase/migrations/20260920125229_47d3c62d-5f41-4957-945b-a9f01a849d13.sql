
DROP POLICY IF EXISTS "insert own partner rows" ON public.study_partners;
REVOKE INSERT, UPDATE ON public.study_partners FROM authenticated, anon;
