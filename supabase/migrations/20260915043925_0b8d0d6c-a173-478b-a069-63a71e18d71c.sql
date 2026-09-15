
CREATE TABLE public.weekly_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_key text NOT NULL,
  user_a uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  title text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  carry_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_tasks TO authenticated;
GRANT ALL ON public.weekly_tasks TO service_role;
ALTER TABLE public.weekly_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pair members can view weekly tasks" ON public.weekly_tasks
  FOR SELECT TO authenticated USING (auth.uid() = user_a OR auth.uid() = user_b);
CREATE POLICY "Pair members can add weekly tasks" ON public.weekly_tasks
  FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_a OR auth.uid() = user_b) AND auth.uid() = created_by);
CREATE POLICY "Pair members can update weekly tasks" ON public.weekly_tasks
  FOR UPDATE TO authenticated USING (auth.uid() = user_a OR auth.uid() = user_b)
  WITH CHECK (auth.uid() = user_a OR auth.uid() = user_b);
CREATE POLICY "Pair members can delete weekly tasks" ON public.weekly_tasks
  FOR DELETE TO authenticated USING (auth.uid() = user_a OR auth.uid() = user_b);

CREATE INDEX idx_weekly_tasks_pair_week ON public.weekly_tasks (pair_key, week_start);

CREATE TABLE public.weekly_task_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.weekly_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_task_completions TO authenticated;
GRANT ALL ON public.weekly_task_completions TO service_role;
ALTER TABLE public.weekly_task_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pair members can view completions" ON public.weekly_task_completions
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.weekly_tasks t WHERE t.id = task_id AND (auth.uid() = t.user_a OR auth.uid() = t.user_b))
  );
CREATE POLICY "Users tick their own completion" ON public.weekly_task_completions
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM public.weekly_tasks t WHERE t.id = task_id AND (auth.uid() = t.user_a OR auth.uid() = t.user_b))
  );
CREATE POLICY "Users remove their own completion" ON public.weekly_task_completions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_weekly_task_completions_task ON public.weekly_task_completions (task_id);

CREATE TABLE public.board_seen (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  board text NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, board)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.board_seen TO authenticated;
GRANT ALL ON public.board_seen TO service_role;
ALTER TABLE public.board_seen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own board seen" ON public.board_seen
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_weekly_tasks_updated_at BEFORE UPDATE ON public.weekly_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Carry unfinished tasks from previous weeks into the current week.
CREATE OR REPLACE FUNCTION public.ensure_weekly_tasks()
RETURNS date
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_partner uuid;
  v_pair text;
  v_week date := (date_trunc('week', (now() AT TIME ZONE 'Asia/Kolkata'))::date);
  v_required int;
BEGIN
  IF v_me IS NULL THEN RETURN NULL; END IF;
  v_partner := public.my_partner_id();
  IF v_partner IS NULL THEN
    v_pair := public.pair_key_for(v_me, v_me);
    v_required := 1;
  ELSE
    v_pair := public.pair_key_for(v_me, v_partner);
    v_required := 2;
  END IF;

  UPDATE public.weekly_tasks t
  SET week_start = v_week,
      carry_count = t.carry_count + 1,
      updated_at = now()
  WHERE t.pair_key = v_pair
    AND t.week_start < v_week
    AND (SELECT count(*) FROM public.weekly_task_completions c WHERE c.task_id = t.id) < v_required;

  RETURN v_week;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ensure_weekly_tasks() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_weekly_tasks() TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.weekly_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.weekly_task_completions;
