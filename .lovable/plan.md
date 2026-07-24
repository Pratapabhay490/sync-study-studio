
# Partner-First Study Experience

Reframe the app around the two-person partnership without breaking existing tracking. New surfaces plug into the current auth, data, and notification pipelines.

## 1. Partner Home (new default after login)

Replace the current dashboard landing with a warmer "Partner Home" at `/dashboard`. Move the analytics-heavy current dashboard content to `/dashboard/overview` (kept intact).

Sections, top → bottom:
- **Partner header**: your avatar + partner avatar side-by-side, with live presence dot (online / studying / away / offline) and a one-line status ("Aishwarya is studying Pharmacology · 24 min"). Presence powered by a new `presence` table + Supabase Realtime broadcast heartbeat every 30s.
- **Today's shared goal**: single sentence set during morning check-in, editable inline. Shows a shared progress bar (topics completed today across both users).
- **Dual progress rings**: reuse `ProgressRing` — your overall % and partner's %, with names + subtle gradient per user.
- **Study Together card**: primary CTA "Start focus session". Shows current session state if one is live (see §4).
- **Quick actions row**: Cheer 🎉, Poke 👋, Send Reaction 💬, Start Session ▶️ — all as clay pill buttons.
- **Continue where you left off**: last topic you toggled or last quiz you played, deep-linked.
- **Recent activity feed**: chronological blend of topic completions, quiz finishes, check-ins, cheers, subject completions — last 20 events, avatar + verb + object + timeago.
- **Friendly competition strip** (see §2) as the last card.

## 2. Friendly Competition (team-oriented)

New "Team Stats" card, not a leaderboard:
- Days studied together this week (both active same day)
- Combined topics completed this week
- Current shared streak (consecutive days both partners logged progress)
- Individual streaks shown as small side-by-side chips, not ranked

Copy: "You're on a 6-day streak together 🔥" not "Abhay is winning".

## 3. Reactions & celebrations

New `reactions` table (`from_user`, `to_user`, `kind`, `context` jsonb, `created_at`). Kinds: `cheer`, `keep_going`, `proud`, `congrats`, `high_five`.

- Reaction picker popover on Partner Home + inline on any activity feed item ("react to this").
- Each reaction fires a push via existing `notification_queue` pipeline with warm copy.
- Confetti burst locally on send; toast on receive.
- Debounce: max 1 same-kind reaction per partner per 5 min (client + trigger check).

## 4. Study Together Session

New `focus_sessions` table: `id, host_id, partner_id, started_at, ends_at, duration_min, state (studying|break|ended), created_at`. Plus `focus_session_events` for join/leave.

Flow:
- Host taps "Start focus session" → picks 25 / 50 / 90 min → row inserted, partner gets push "Abhay started a 50-min focus session — join?" with deep link.
- Both see synced countdown (server `ends_at` is truth; client just renders). State chip: 🟢 Studying together / ☕ Break / ⚪ Offline.
- Simple controls: Pause (host-only, converts to break), End early, Extend +10.
- Realtime channel keyed by session id for join/leave/state broadcasts.
- Mobile-first single-column layout with big timer.

## 5. Daily Check-in

New `daily_checkins` table: `user_id, date, morning_goal, planned_topics text[], planned_minutes int, night_completed bool, night_note, morning_at, night_at`.

- **Morning prompt** (first visit after 4am local, before noon): modal with 3 fields — goal, planned topics (chips from their subjects), planned minutes. Quick — under 20s.
- **Night prompt** (first visit after 8pm local): "Did you hit today's goal?" Yes/Partial/No + optional note.
- On each submit, queue a push summary to partner: "Aishwarya's plan today: Finish Pharma Ch 4 · ~120 min 💪" / "Aishwarya wrapped up — hit her goal ✅".
- Partner Home shows both partners' check-in cards (goal + status pill).

## 6. Gentle accountability nudges

Extend existing `schedule-motivation` cron logic:
- If partner hasn't logged activity in >36h, once per day queue a soft nudge to the *active* partner: "Aishwarya's been quiet today — send a little encouragement 💛" with a one-tap Cheer button (deep link that fires a reaction).
- If a user misses morning check-in by noon local, one gentle self-nudge: "No pressure — want to set a tiny goal for today? ☀️".
- All copy warm, no guilt words ("failed", "behind", "slacking" banned).

## 7. UI/UX polish

- New `PartnerHome` route becomes the post-login default. Sidebar gets a "Home" entry pointing here; "Analytics" keeps its slot.
- Consistent clay cards, generous spacing, 2-col on desktop / stacked on mobile.
- Warm accents: soft gradients per user (existing Abhay/Aishwarya gradients generalize to `user-a` / `user-b` based on partner ordering).
- Microinteractions: hover lift on cards, confetti on completions/reactions, subtle avatar pulse when partner is live.
- Reuse existing tokens, `framer-motion`, `canvas-confetti`, `ScrollReveal`.

## Technical section

**New tables** (migration, all with GRANT + RLS scoped to owner + partner via `is_partner_of`):
- `presence(user_id pk, status, current_activity, updated_at)` — upsert on heartbeat.
- `reactions(id, from_user, to_user, kind, context jsonb, created_at)` + trigger `queue_reaction_notification` mirroring `queue_poke_notification`.
- `focus_sessions(id, host_id, partner_id, duration_min, started_at, ends_at, state, created_at)` + `focus_session_events(session_id, user_id, kind, at)`.
- `daily_checkins(id, user_id, date, morning_goal, planned_topics text[], planned_minutes int, night_status text, night_note, morning_at, night_at)` unique(user_id, date) + trigger to queue partner summary.

**New RPCs**: `start_focus_session(duration_min)`, `join_focus_session(id)`, `end_focus_session(id)`, `send_reaction(to_user, kind, context)`, `submit_morning_checkin(...)`, `submit_night_checkin(...)`, `heartbeat_presence(activity)`.

**Cron additions** (extend existing 5×/day motivation cron):
- Every 30 min: inactivity nudge scan.
- Daily 12:00 IST: missing-morning-checkin nudge.

**Files**:
- Migration for schemas, RLS, triggers, RPCs, GRANTs.
- `src/routes/_authenticated/dashboard.tsx` → becomes Partner Home. Existing content → `src/routes/_authenticated/dashboard.overview.tsx`.
- New components: `PartnerHeader`, `DualRings`, `TodayGoalCard`, `FocusSessionCard`, `ActivityFeed`, `TeamStatsCard`, `ReactionPicker`, `CheckinModal`.
- `src/lib/presence.ts` heartbeat hook.
- `src/lib/reactions.ts`, `src/lib/focus-session.ts`, `src/lib/checkin.ts` client helpers.
- Extend `supabase/functions/schedule-motivation/index.ts` with inactivity + missed-checkin branches; add cron entries.
- Small tweaks to sidebar nav and `poke-button` copy (unchanged behavior).

**Kept intact**: all existing tracking (subjects, topics, progress, practice/quiz, pokes, push pipeline, custom countdown, analytics page, daily task board).

**Assumption to confirm or correct**: default landing after login switches to Partner Home; the current analytics-style dashboard remains available at `/dashboard/overview`. If you'd rather keep the current dashboard as landing and add Partner Home at `/home`, tell me and I'll flip it.
