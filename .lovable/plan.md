# Daily board on Home and faster page loading

## What will change

- Add a lively **Today’s Task Board** directly to the Home dashboard, positioned near the daily progress area where it is immediately useful.
- Show both partners side by side with avatars, completion rings, live task counts, and clear completed/remaining states.
- Let the signed-in user add, complete, reopen, and delete today’s tasks without leaving Home.
- Add tactile completion feedback and a small celebration when a task is finished, while respecting reduced-motion settings.
- Keep the existing full Daily Board page available through a compact “Open full board” action, but remove its separate sidebar entry so the feature feels part of Home rather than a disconnected destination.

## Speed improvements

- Extract the task board into one reusable component shared by Home and the full board page, avoiding duplicate queries and behavior.
- Update task changes locally and subscribe only to today’s relevant task rows; avoid reloading the whole list after every live event.
- Replace the global “refetch every study table” behavior with targeted in-memory updates for live changes, reducing repeated downloads and screen buffering.
- Precompute dashboard topic/progress lookups once instead of repeatedly scanning full arrays for every subject and activity row.
- Remove overlapping reveal work on elements already handled by the dedicated reveal component, and avoid persistent animation/compositing work after elements appear.
- Defer below-the-fold dashboard rendering work with the existing visibility optimization, without changing appearance or functionality.

## Verification

- Test adding, completing, reopening, and deleting tasks from Home.
- Confirm partner task updates appear live and the full board still works.
- Check Home, Subjects, and Subject Details at desktop and mobile sizes for unchanged visuals and smoother scrolling/loading.
- Confirm the final build and browser console are clean.

## Technical details

- No database schema or feature behavior changes are required.
- Existing permissions, partner visibility, progress calculations, notifications, and routes remain intact.
- The dashboard task section will use the current clay design tokens and existing shared controls.
