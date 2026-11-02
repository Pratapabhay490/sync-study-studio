# Roadmap

- [x] Add confirmed fresh-start reset preserving customized subjects/topics and partner progress.
- [x] Add confirmed permanent self-account deletion preserving the partner's workspace.
- [x] Test reset and deletion cleanup safely with rollback and confirmation unit tests.
- [ ] Verify signed-in Settings warnings and full account-deletion flow — blocked because the requesting user has no matching account session.

- [x] Upgrade all 40 genuine avatar animations to 128px/12fps, capped at 150KB each (144KB average).
- [x] Verify all 40 clips decode and the 64px avatar visibly animates with only its selected clip requested and no page errors.

- [x] Move today’s collaborative task board onto Home.
- [x] Preserve the full dated task-board view.
- [x] Add optimistic task interactions, completion feedback, and focused live updates.
- [x] Remove the separate sidebar task-board entry.
- [x] Reduce broad live-data reloads and repeated dashboard calculations.
- [x] Reduce duplicate reveal/compositing work and defer lower-page rendering.
- [x] Confirm the preview build is clean.
- [x] Optimize Dashboard and Home cards and controls for phone widths.
- [ ] Run authenticated desktop/mobile interaction verification — blocked until a user signs into the preview.
