ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS countdown_label text,
  ADD COLUMN IF NOT EXISTS countdown_date timestamptz,
  ADD COLUMN IF NOT EXISTS countdown_sync boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS countdown_updated_at timestamptz;