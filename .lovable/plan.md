
# Playful Partner-First SyncStudy

Layer gamification and warmth on top of what already exists. Nothing in the current tracking, quiz, or push pipeline changes. All new surfaces plug into `/home` (Partner Home) and a new `/journey` route.

## Assumption
`/home` (Partner Home, already live) stays the post-login default. The current analytics dashboard remains at `/dashboard`. Tell me if you want the split different.

## 1. XP + Levels (core loop)

New table `user_xp_events(id, user_id, kind, amount, ref_id, ref_type, created_at)` + view `user_xp_totals`.

XP rewards (all server-side via triggers/RPCs so client can't cheat):
- Complete a topic: **10 XP**
- Complete a subject (100%): **150 XP** + confetti + badge check
- Finish a quiz: **5 XP per correct + 25 XP bonus if ≥80%**
- Finish a focus session (≥25 min, both partners joined): **50 XP each**
- Hit night check-in "yes": **20 XP**
- Send a reaction to partner: **3 XP** (max 30/day, to prevent spam)
- 7-day together streak milestone: **100 XP each**

Levels via `floor(sqrt(xp / 50))` — level 5 ≈ 1,250 XP, level 10 ≈ 5,000 XP. Titles: Novice → Focused → Sharp → Sharper → Scholar → Physician-in-Training → …

UI: XP bar in Partner Home header with smooth `framer-motion` count-up + level-up popup with confetti.

## 2. Badges & Achievements

New table `badges` (catalog) + `user_badges(user_id, badge_key, unlocked_at, context jsonb)`. Server-side unlock via triggers on `topic_progress`, `quiz_answers`, `focus_sessions`, `daily_checkins`.

Initial catalog (~18): First Topic, First Subject, Subject Slayer (5), Century Club (100 topics), Quiz Rookie, Sharpshooter (90%+ quiz), Perfectionist (100%), MCQ 100 / 500 / 1000, Early Bird (check-in before 7am ×5), Night Owl (study after 11pm ×5), Motivator (10 reactions sent), First Focus, Focus Marathon (90-min session), 7-Day Together, 30-Day Together, First Partner, Sync Duo (both hit night goal same day ×5).

Unlock feel: full-screen badge card slides in with `scale-in` + confetti + push to partner ("Aishwarya just unlocked Sharpshooter 🎯").

## 3. Together Streaks + Weekly Challenges

- `together_streaks(pair_key, current, longest, last_shared_day)` updated by daily job.
- Flame streak chip with escalating emoji (🔥 3+, 🔥🔥 7+, 🔥🔥🔥 14+, 🌟 30+).
- New `weekly_challenges` table seeded weekly: "Complete 20 topics together", "Both hit night goal 5 days", "Study 6 hours combined". Reward: badge + XP. Progress bar on Partner Home.

## 4. Study Tree 🌱

Purely visual, powered by XP + together-streak. Stages: seed → sprout → sapling → young tree → flowering → fruiting. SVG component in `src/components/study-tree.tsx`, animated growth with `framer-motion`. Both partners "own" the same tree — grows on combined XP this week.

## 5. Partner Mascot 🐣

Small evolving pet (SVG/PNG stages): egg → chick → fledgling → wise owl. Evolves at level milestones (5, 10, 20, 35). Mood reflects last 3 days of shared activity (happy/sleepy/hungry). Bottom-right floating widget on Partner Home only, dismissible.

## 6. Study Journey Timeline

New route `/journey`. Fetches milestone events (`user_xp_events` kinds + `user_badges` + `focus_sessions` + partner join date) and renders a vertical clay timeline with both partners' avatars per node. Filters: All / Yours / Partner / Badges.

## 7. Partner Home refinements

Reorder + additions to existing `src/routes/_authenticated/home.tsx`:
1. Partner header (existing) — add XP bar + level chip + streak flame
2. Warm greeting ("Good morning, Abhay — Aishwarya is 12 min into Pharma")
3. Today's Mission (from morning check-in) — inline edit
4. Dual progress rings (existing) — add level rings around avatars
5. Study Together card (existing)
6. Weekly Challenge card (new)
7. Study Tree card (new)
8. Recent activity feed (existing) — inline react buttons on every item
9. Continue where you left off (existing)
10. Team stats + badges shelf (new — last 6 unlocked)

Mascot floats bottom-right.

## 8. Gentle nudges (extend existing cron)

`schedule-motivation` gains two branches:
- Partner inactive >36h → soft cheer prompt to active partner
- User missed morning check-in past noon local → gentle self-nudge

No guilt words. Reuse existing warm copy patterns.

## 9. UI polish pass

- Animated ring fill + count-up XP everywhere with `framer-motion`
- Confetti on: topic complete (small), subject complete (big), badge unlock, level up, quiz ≥80%, streak milestone
- Floating hearts animation on cheer send
- Streak flame with pulsing glow
- Badge popup modal with shine sweep
- All motion respects `prefers-reduced-motion`
- Mobile-first: stacked single column <768px, 2-col ≥768px, 3-col ≥1280px

## Technical

**Migration** (single):
- Tables: `user_xp_events`, `badges` (catalog + seed rows), `user_badges`, `together_streaks`, `weekly_challenges`, `weekly_challenge_progress`.
- View: `user_xp_totals` (sum + level).
- RLS: users read own + partner's rows via `is_partner_of`; writes only via SECURITY DEFINER RPCs.
- Triggers: `award_xp_topic_complete`, `award_xp_subject_complete`, `check_badges_after_topic`, `check_badges_after_quiz`, `check_badges_after_focus`, `bump_together_streak_daily`.
- RPCs: `award_xp(kind, amount, ref)`, `claim_weekly_challenge()`, `refresh_together_streak()`.
- pg_cron: nightly `bump_together_streak_daily()` + Monday 00:00 IST `rotate_weekly_challenge()`.
- GRANTs on every new public table.

**New files**:
- `src/lib/xp.ts` — level math, hooks (`useMyXp`, `usePartnerXp`), count-up helper.
- `src/lib/badges.ts` — catalog metadata (icon, title, hint), unlock hook, popup context.
- `src/lib/streaks.ts` — together streak hook + flame renderer.
- `src/components/xp-bar.tsx`, `level-badge.tsx`, `badge-popup.tsx`, `badge-shelf.tsx`.
- `src/components/study-tree.tsx`, `partner-mascot.tsx`.
- `src/components/weekly-challenge-card.tsx`.
- `src/components/floating-hearts.tsx`.
- `src/routes/_authenticated/journey.tsx`.

**Edited files**:
- `src/routes/_authenticated/home.tsx` — insert new sections, add XP/level to header.
- `src/routes/_authenticated/route.tsx` — sidebar entry for Journey.
- `src/components/reaction-bar.tsx` — trigger floating hearts + XP toast.
- `supabase/functions/schedule-motivation/index.ts` — inactivity + missed-checkin branches.

**Kept intact**: subjects, topics, progress, practice/quiz, pokes, push pipeline, custom countdown, analytics, daily board, focus sessions, check-ins, reactions.

## Rollout

One migration (schema + seeds + triggers) → then component wave → then home reflow → then journey route. Verify: push notifications for level-up and badge unlock go to partner via existing queue; XP totals visible in header; study tree animates on XP change.
