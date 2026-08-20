-- subjects_owner_name_key (unique) already covers both of these
DROP INDEX IF EXISTS public.subjects_owner_name_idx;
DROP INDEX IF EXISTS public.subjects_owner_idx;

-- focus_sessions_active_idx (state, ends_at DESC) already covers active lookups
DROP INDEX IF EXISTS public.focus_sessions_open_idx;

-- focus_sessions_host_started_idx / partner_started_idx serve the same access
-- path as these created_at variants; started_at is what the app orders by.
DROP INDEX IF EXISTS public.focus_sessions_host_idx;
DROP INDEX IF EXISTS public.focus_sessions_partner_idx;

ANALYZE public.subjects;
ANALYZE public.focus_sessions;