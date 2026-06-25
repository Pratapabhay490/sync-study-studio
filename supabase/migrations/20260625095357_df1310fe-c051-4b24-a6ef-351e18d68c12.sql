
-- push_subscriptions
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own subs" ON public.push_subscriptions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_push_subs_user ON public.push_subscriptions(user_id);

-- pokes
CREATE TABLE public.pokes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL DEFAULT 'Let''s study! 📚',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pokes TO authenticated;
GRANT ALL ON public.pokes TO service_role;
ALTER TABLE public.pokes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pokes viewable by sender or receiver" ON public.pokes
  FOR SELECT USING (auth.uid() = from_user OR auth.uid() = to_user);
CREATE POLICY "users send pokes as themselves" ON public.pokes
  FOR INSERT WITH CHECK (auth.uid() = from_user);
CREATE POLICY "receiver marks read" ON public.pokes
  FOR UPDATE USING (auth.uid() = to_user);
CREATE INDEX idx_pokes_to ON public.pokes(to_user, created_at DESC);

-- notification_queue
CREATE TABLE public.notification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  url text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
GRANT SELECT ON public.notification_queue TO authenticated;
GRANT ALL ON public.notification_queue TO service_role;
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own queued" ON public.notification_queue
  FOR SELECT USING (auth.uid() = user_id);
CREATE INDEX idx_queue_pending ON public.notification_queue(processed, created_at) WHERE processed = false;

-- Trigger: when a topic_progress is marked complete, queue a notification for every OTHER user
CREATE OR REPLACE FUNCTION public.queue_topic_complete_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sender_name text;
  topic_name text;
  subject_name text;
  other_user_id uuid;
BEGIN
  IF NEW.completed = true AND (OLD IS NULL OR OLD.completed = false) THEN
    SELECT COALESCE(p.name, p.email, 'Your partner') INTO sender_name
      FROM public.profiles p WHERE p.id = NEW.user_id;
    SELECT t.topic_name, s.name INTO topic_name, subject_name
      FROM public.topics t LEFT JOIN public.subjects s ON s.id = t.subject_id
      WHERE t.id = NEW.topic_id;

    FOR other_user_id IN
      SELECT id FROM public.profiles WHERE id <> NEW.user_id
    LOOP
      INSERT INTO public.notification_queue (user_id, kind, title, body, url, data)
      VALUES (
        other_user_id,
        'partner_topic_complete',
        sender_name || ' just finished a topic! 🎉',
        COALESCE(subject_name || ' • ', '') || COALESCE(topic_name, 'a topic'),
        '/dashboard',
        jsonb_build_object('from', NEW.user_id, 'topic_id', NEW.topic_id)
      );
    END LOOP;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_topic_complete_notify ON public.topic_progress;
CREATE TRIGGER trg_topic_complete_notify
  AFTER INSERT OR UPDATE ON public.topic_progress
  FOR EACH ROW EXECUTE FUNCTION public.queue_topic_complete_notification();

-- Trigger: when a poke is inserted, queue a push for the recipient
CREATE OR REPLACE FUNCTION public.queue_poke_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sender_name text;
BEGIN
  SELECT COALESCE(p.name, p.email, 'Someone') INTO sender_name
    FROM public.profiles p WHERE p.id = NEW.from_user;
  INSERT INTO public.notification_queue (user_id, kind, title, body, url, data)
  VALUES (
    NEW.to_user,
    'poke',
    sender_name || ' poked you 👋',
    NEW.message,
    '/dashboard',
    jsonb_build_object('from', NEW.from_user, 'poke_id', NEW.id)
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_poke_notify ON public.pokes;
CREATE TRIGGER trg_poke_notify
  AFTER INSERT ON public.pokes
  FOR EACH ROW EXECUTE FUNCTION public.queue_poke_notification();

-- updated_at trigger for push_subscriptions
CREATE TRIGGER trg_push_subs_updated BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for pokes so in-app toast can fire instantly
ALTER PUBLICATION supabase_realtime ADD TABLE public.pokes;

-- Enable extensions for cron-driven push processing
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
