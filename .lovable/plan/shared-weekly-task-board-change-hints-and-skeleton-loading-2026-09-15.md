# Shared weekly task board, change hints, and skeleton loading

## Weekly task board (new, on the dashboard)

- One shared list for both partners, running Monday to Sunday.
- Either partner can add, rename-free edit (add/delete), and tick tasks off; everything syncs live.
- A task counts as finished only when **both** partners have ticked it. Each task shows two small avatar ticks so you can see who is done.
- At the start of a new week, any task not finished by both partners is carried forward automatically and shows a "carried over" mark with the number of weeks it has been rolling.
- Finished-by-both tasks stay in the current week and do not carry over.
- Clay styling to match the app: puffy cards, a progress ring for the week, a clay character beside the header, tick animation and a small celebration when both partners complete a task.

## "Your partner changed something" hints

- The daily board and the weekly board each show a soft pulsing dot when your partner has added, ticked, or removed something since you last looked at that board.
- The dot clears once you view that board. A matching dot appears on the board header so it is obvious which list changed.

## Faster loading and skeletons

- Replace the spinning clay loader and remaining spinner screens with skeleton placeholders shaped like the real content (dashboard, subjects list, subject detail, practice lists).
- Load the dashboard sections without blocking on every query, so content appears progressively instead of waiting behind one loader.

## Push notification check

- After the build, verify every push pipeline end to end: queued items drain, cron jobs are active, subscriptions are healthy, and a test notification for the new weekly board updates delivers.

## Technical details

- New table `weekly_tasks` (week_start date, title, pair key, creator) plus `weekly_task_completions` (task_id, user_id) so "done" is per-partner; unique constraint per task/user. RLS scoped so both partners in a pair can read and write, with GRANTs for authenticated.
- A carry-forward function creates the current week's view by rolling any prior-week task with fewer than two completions into the current `week_start`, run lazily on first load of the week.
- Change hints tracked in a small `board_seen` table (user, board kind, last seen timestamp) compared against the latest task/completion update time; realtime subscription keeps the dot live.
- Shared board component reuses the existing daily-board patterns: narrow realtime filters, optimistic updates, and `sonner` toasts.
- Skeletons use the existing `components/ui/skeleton`.
