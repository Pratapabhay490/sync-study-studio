DO $$
DECLARE
  abhay uuid := 'd7f0a376-03af-4af0-99d4-f1051941976c';
  t1 uuid := '346213d2-f4db-46a5-bc51-9d185cb25501';
  t2 uuid := 'd0112f28-21bd-4be6-9c63-7a047ae4bb49';
BEGIN
  -- 1. Give the merged workspace back to Abhay
  UPDATE public.subjects SET owner_id = abhay, created_by = abhay WHERE owner_id = t2;
  UPDATE public.topics SET owner_id = abhay WHERE owner_id = t2;
  UPDATE public.topics SET added_by = abhay WHERE added_by IN (t1, t2);

  -- 2. Remove the empty placeholder subject created during the test
  DELETE FROM public.topic_progress tp
   USING public.topics tp2, public.subjects s
   WHERE tp.topic_id = tp2.id AND tp2.subject_id = s.id AND s.name = 'No subjects';
  DELETE FROM public.topics t USING public.subjects s
   WHERE t.subject_id = s.id AND s.name = 'No subjects';
  DELETE FROM public.subjects WHERE name = 'No subjects';

  -- 3. Remove the second test account's cloned workspace
  DELETE FROM public.topic_progress tp
   USING public.topics t, public.subjects s
   WHERE tp.topic_id = t.id AND t.subject_id = s.id AND s.owner_id = t1;
  DELETE FROM public.topics t USING public.subjects s
   WHERE t.subject_id = s.id AND s.owner_id = t1;
  DELETE FROM public.subjects WHERE owner_id = t1;

  -- 4. Remove progress rows belonging to the test accounts
  DELETE FROM public.topic_progress WHERE user_id IN (t1, t2);

  -- 5. Clear partner links and invites involving the test accounts
  DELETE FROM public.study_partners WHERE user_id IN (t1, t2) OR partner_id IN (t1, t2);
  DELETE FROM public.partner_invites WHERE from_user IN (t1, t2) OR to_user IN (t1, t2);
END $$;