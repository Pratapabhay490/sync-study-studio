
CREATE TABLE public.daily_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT false,
  task_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  position INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_tasks TO authenticated;
GRANT ALL ON public.daily_tasks TO service_role;

ALTER TABLE public.daily_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their daily tasks"
  ON public.daily_tasks FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Partners can view daily tasks"
  ON public.daily_tasks FOR SELECT
  TO authenticated
  USING (public.is_partner_of(auth.uid(), user_id));

CREATE INDEX daily_tasks_user_date_idx ON public.daily_tasks (user_id, task_date DESC);

CREATE TRIGGER update_daily_tasks_updated_at
  BEFORE UPDATE ON public.daily_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_tasks;
ALTER TABLE public.daily_tasks REPLICA IDENTITY FULL;
