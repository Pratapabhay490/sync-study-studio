
-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by authenticated users" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Subjects table
CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  icon TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subjects TO authenticated;
GRANT ALL ON public.subjects TO service_role;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Subjects viewable by authenticated" ON public.subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert subjects" ON public.subjects FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can update subjects" ON public.subjects FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can delete subjects" ON public.subjects FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- Topics table
CREATE TABLE public.topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  topic_name TEXT NOT NULL,
  description TEXT,
  added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.topics TO authenticated;
GRANT ALL ON public.topics TO service_role;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Topics viewable by authenticated" ON public.topics FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert topics" ON public.topics FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can update topics" ON public.topics FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can delete topics" ON public.topics FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE INDEX topics_subject_id_idx ON public.topics(subject_id);

-- Topic progress
CREATE TABLE public.topic_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(topic_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.topic_progress TO authenticated;
GRANT ALL ON public.topic_progress TO service_role;
ALTER TABLE public.topic_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Progress viewable by authenticated" ON public.topic_progress FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users insert own progress" ON public.topic_progress FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own progress" ON public.topic_progress FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own progress" ON public.topic_progress FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX topic_progress_topic_id_idx ON public.topic_progress(topic_id);
CREATE INDEX topic_progress_user_id_idx ON public.topic_progress(user_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_subjects_updated BEFORE UPDATE ON public.subjects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_topics_updated BEFORE UPDATE ON public.topics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_progress_updated BEFORE UPDATE ON public.topic_progress FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Realtime
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.subjects REPLICA IDENTITY FULL;
ALTER TABLE public.topics REPLICA IDENTITY FULL;
ALTER TABLE public.topic_progress REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.subjects;
ALTER PUBLICATION supabase_realtime ADD TABLE public.topics;
ALTER PUBLICATION supabase_realtime ADD TABLE public.topic_progress;

-- Seed 19 MBBS subjects
INSERT INTO public.subjects (name, icon) VALUES
  ('Anatomy', 'Bone'),
  ('Physiology', 'Activity'),
  ('Biochemistry', 'FlaskConical'),
  ('Pathology', 'Microscope'),
  ('Pharmacology', 'Pill'),
  ('Microbiology', 'Bug'),
  ('Forensic Medicine', 'Scale'),
  ('Community Medicine', 'Users'),
  ('ENT', 'Ear'),
  ('Ophthalmology', 'Eye'),
  ('General Medicine', 'Stethoscope'),
  ('General Surgery', 'Scissors'),
  ('Pediatrics', 'Baby'),
  ('Orthopedics', 'Bone'),
  ('Obstetrics and Gynecology', 'Heart'),
  ('Dermatology', 'Hand'),
  ('Psychiatry', 'Brain'),
  ('Radiology', 'ScanLine'),
  ('Anesthesiology', 'Syringe');

-- Seed sample topics
DO $$
DECLARE s_id UUID;
BEGIN
  SELECT id INTO s_id FROM public.subjects WHERE name='Anatomy';
  INSERT INTO public.topics (subject_id, topic_name, description) VALUES
    (s_id, 'Upper Limb', 'Bones, muscles, vessels of upper limb'),
    (s_id, 'Lower Limb', 'Bones, muscles, vessels of lower limb'),
    (s_id, 'Thorax', 'Thoracic wall, lungs, heart anatomy'),
    (s_id, 'Abdomen', 'Abdominal viscera and peritoneum'),
    (s_id, 'Head and Neck', 'Skull, face, neck triangles'),
    (s_id, 'Neuroanatomy', 'Brain and spinal cord anatomy');

  SELECT id INTO s_id FROM public.subjects WHERE name='Physiology';
  INSERT INTO public.topics (subject_id, topic_name, description) VALUES
    (s_id, 'General Physiology', 'Cell, membrane transport'),
    (s_id, 'Nerve Muscle', 'Action potential, NMJ'),
    (s_id, 'CVS Physiology', 'Cardiac cycle, ECG basics'),
    (s_id, 'Respiratory Physiology', 'Lung volumes, gas exchange'),
    (s_id, 'Renal Physiology', 'GFR, tubular function'),
    (s_id, 'Endocrine Physiology', 'Hormones overview');

  SELECT id INTO s_id FROM public.subjects WHERE name='Biochemistry';
  INSERT INTO public.topics (subject_id, topic_name, description) VALUES
    (s_id, 'Carbohydrate Metabolism', 'Glycolysis, TCA, gluconeogenesis'),
    (s_id, 'Lipid Metabolism', 'Beta-oxidation, lipoproteins'),
    (s_id, 'Protein Metabolism', 'Urea cycle, amino acids'),
    (s_id, 'Enzymes', 'Kinetics and regulation'),
    (s_id, 'Vitamins', 'Fat and water soluble vitamins');

  SELECT id INTO s_id FROM public.subjects WHERE name='Pathology';
  INSERT INTO public.topics (subject_id, topic_name, description) VALUES
    (s_id, 'Cell Injury', 'Necrosis, apoptosis'),
    (s_id, 'Inflammation', 'Acute and chronic inflammation'),
    (s_id, 'Neoplasia', 'Tumor biology, staging'),
    (s_id, 'Hematology', 'Anemias, leukemias'),
    (s_id, 'Systemic Pathology', 'Organ-wise pathology');

  SELECT id INTO s_id FROM public.subjects WHERE name='Pharmacology';
  INSERT INTO public.topics (subject_id, topic_name, description) VALUES
    (s_id, 'General Pharmacology', 'PK and PD principles'),
    (s_id, 'ANS Drugs', 'Sympathomimetics, parasympatholytics'),
    (s_id, 'CVS Drugs', 'Antihypertensives, antianginals'),
    (s_id, 'Antimicrobials', 'Antibiotics overview'),
    (s_id, 'CNS Drugs', 'Sedatives, anticonvulsants');

  SELECT id INTO s_id FROM public.subjects WHERE name='Microbiology';
  INSERT INTO public.topics (subject_id, topic_name, description) VALUES
    (s_id, 'General Microbiology', 'Staining, sterilization'),
    (s_id, 'Bacteriology', 'Gram positive and negative cocci/rods'),
    (s_id, 'Virology', 'DNA and RNA viruses'),
    (s_id, 'Mycology', 'Fungal infections'),
    (s_id, 'Parasitology', 'Protozoa, helminths');

  SELECT id INTO s_id FROM public.subjects WHERE name='Forensic Medicine';
  INSERT INTO public.topics (subject_id, topic_name, description) VALUES
    (s_id, 'Thanatology', 'Death and changes after death'),
    (s_id, 'Injuries', 'Mechanical and thermal injuries'),
    (s_id, 'Toxicology', 'Common poisons'),
    (s_id, 'Forensic Psychiatry', 'Legal aspects of mental illness');

  SELECT id INTO s_id FROM public.subjects WHERE name='Community Medicine';
  INSERT INTO public.topics (subject_id, topic_name, description) VALUES
    (s_id, 'Epidemiology', 'Study designs, measures'),
    (s_id, 'Biostatistics', 'Tests of significance'),
    (s_id, 'National Health Programs', 'NHM, RNTCP, NVBDCP'),
    (s_id, 'Nutrition', 'Macro and micronutrients'),
    (s_id, 'Demography', 'Population dynamics');

  SELECT id INTO s_id FROM public.subjects WHERE name='ENT';
  INSERT INTO public.topics (subject_id, topic_name, description) VALUES
    (s_id, 'Ear Diseases', 'CSOM, otosclerosis'),
    (s_id, 'Nose and PNS', 'Sinusitis, DNS'),
    (s_id, 'Throat', 'Tonsillitis, laryngeal cancer'),
    (s_id, 'Head and Neck', 'Neck masses');

  SELECT id INTO s_id FROM public.subjects WHERE name='Ophthalmology';
  INSERT INTO public.topics (subject_id, topic_name, description) VALUES
    (s_id, 'Cornea and Lens', 'Cataract, keratitis'),
    (s_id, 'Glaucoma', 'Types and management'),
    (s_id, 'Retina', 'Retinal detachment, DR'),
    (s_id, 'Refractive Errors', 'Myopia, hyperopia');

  SELECT id INTO s_id FROM public.subjects WHERE name='General Medicine';
  INSERT INTO public.topics (subject_id, topic_name, description) VALUES
    (s_id, 'Cardiology', 'IHD, heart failure'),
    (s_id, 'Pulmonology', 'COPD, asthma, TB'),
    (s_id, 'Gastroenterology', 'Liver disease, IBD'),
    (s_id, 'Endocrinology', 'Diabetes, thyroid'),
    (s_id, 'Neurology', 'Stroke, epilepsy'),
    (s_id, 'Nephrology', 'AKI, CKD');

  SELECT id INTO s_id FROM public.subjects WHERE name='General Surgery';
  INSERT INTO public.topics (subject_id, topic_name, description) VALUES
    (s_id, 'GI Surgery', 'Hernia, appendicitis'),
    (s_id, 'Breast', 'Carcinoma breast'),
    (s_id, 'Endocrine Surgery', 'Thyroid surgeries'),
    (s_id, 'Trauma', 'ATLS principles'),
    (s_id, 'Urology', 'Renal calculi, BPH');

  SELECT id INTO s_id FROM public.subjects WHERE name='Pediatrics';
  INSERT INTO public.topics (subject_id, topic_name, description) VALUES
    (s_id, 'Neonatology', 'Birth asphyxia, jaundice'),
    (s_id, 'Growth and Development', 'Milestones'),
    (s_id, 'Immunization', 'NIS schedule'),
    (s_id, 'Pediatric Infections', 'Common infections'),
    (s_id, 'Nutritional Disorders', 'PEM, deficiencies');

  SELECT id INTO s_id FROM public.subjects WHERE name='Orthopedics';
  INSERT INTO public.topics (subject_id, topic_name, description) VALUES
    (s_id, 'Fractures', 'General principles'),
    (s_id, 'Joint Disorders', 'Arthritis, dislocations'),
    (s_id, 'Spine', 'PIVD, TB spine'),
    (s_id, 'Bone Tumors', 'Benign and malignant');

  SELECT id INTO s_id FROM public.subjects WHERE name='Obstetrics and Gynecology';
  INSERT INTO public.topics (subject_id, topic_name, description) VALUES
    (s_id, 'Antenatal Care', 'ANC visits, screening'),
    (s_id, 'Labor and Delivery', 'Stages, complications'),
    (s_id, 'High Risk Pregnancy', 'PIH, GDM'),
    (s_id, 'Gynecology', 'Menstrual disorders, fibroid'),
    (s_id, 'Contraception', 'Methods overview');

  SELECT id INTO s_id FROM public.subjects WHERE name='Dermatology';
  INSERT INTO public.topics (subject_id, topic_name, description) VALUES
    (s_id, 'Infections', 'Bacterial, fungal, viral'),
    (s_id, 'Papulosquamous', 'Psoriasis, lichen planus'),
    (s_id, 'Vesiculobullous', 'Pemphigus, pemphigoid'),
    (s_id, 'STDs', 'Syphilis, HIV skin manifestations');

  SELECT id INTO s_id FROM public.subjects WHERE name='Psychiatry';
  INSERT INTO public.topics (subject_id, topic_name, description) VALUES
    (s_id, 'Mood Disorders', 'Depression, bipolar'),
    (s_id, 'Psychotic Disorders', 'Schizophrenia'),
    (s_id, 'Anxiety Disorders', 'GAD, OCD, PTSD'),
    (s_id, 'Substance Use', 'Alcohol, opioid dependence');

  SELECT id INTO s_id FROM public.subjects WHERE name='Radiology';
  INSERT INTO public.topics (subject_id, topic_name, description) VALUES
    (s_id, 'X-Ray Basics', 'Chest, abdomen X-ray'),
    (s_id, 'CT and MRI', 'Principles and indications'),
    (s_id, 'Ultrasound', 'Abdominal, obstetric USG'),
    (s_id, 'Interventional Radiology', 'Common procedures');

  SELECT id INTO s_id FROM public.subjects WHERE name='Anesthesiology';
  INSERT INTO public.topics (subject_id, topic_name, description) VALUES
    (s_id, 'General Anesthesia', 'IV and inhalational agents'),
    (s_id, 'Regional Anesthesia', 'Spinal, epidural'),
    (s_id, 'Airway Management', 'Intubation, LMA'),
    (s_id, 'Resuscitation', 'CPR, ACLS');
END $$;
