CREATE TABLE public.weekly_task_progress (
  task_id uuid NOT NULL REFERENCES public.weekly_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  percent integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, user_id),
  CONSTRAINT weekly_task_progress_percent_range CHECK (percent BETWEEN 0 AND 100)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_task_progress TO authenticated;
GRANT ALL ON public.weekly_task_progress TO service_role;
ALTER TABLE public.weekly_task_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pair members view goal progress" ON public.weekly_task_progress
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.weekly_tasks t WHERE t.id = task_id AND (auth.uid() = t.user_a OR auth.uid() = t.user_b))
  );
CREATE POLICY "Users set own goal progress" ON public.weekly_task_progress
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM public.weekly_tasks t WHERE t.id = task_id AND (auth.uid() = t.user_a OR auth.uid() = t.user_b))
  );
CREATE POLICY "Users update own goal progress" ON public.weekly_task_progress
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own goal progress" ON public.weekly_task_progress
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Reaching 100% marks the goal done for that user; dropping below un-marks it.
CREATE OR REPLACE FUNCTION public.sync_weekly_progress_completion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.percent >= 100 THEN
    INSERT INTO public.weekly_task_completions (task_id, user_id)
    VALUES (NEW.task_id, NEW.user_id)
    ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.weekly_task_completions
    WHERE task_id = NEW.task_id AND user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.sync_weekly_progress_completion() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_weekly_progress_completion
  BEFORE INSERT OR UPDATE OF percent ON public.weekly_task_progress
  FOR EACH ROW EXECUTE FUNCTION public.sync_weekly_progress_completion();

ALTER PUBLICATION supabase_realtime ADD TABLE public.weekly_task_progress;