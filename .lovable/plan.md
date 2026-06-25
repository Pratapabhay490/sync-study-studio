# Major Update Plan

## 1. Background Web Push Notifications

**New infra:**
- Generate VAPID key pair (store `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` + `VAPID_SUBJECT` as secrets).
- Add `public/sw.js` service worker handling `push` events and `notificationclick` (focus/open app).
- Register SW + subscribe to push on login. Show a clean in-app permission card (not auto-popup spam).
- New table `push_subscriptions` (user_id, endpoint, p256dh, auth, created_at) with RLS.
- New table `pokes` (from_user, to_user, message, created_at, read) for poke history.
- Install `web-push` package, add server function `sendPushToUser(userId, payload)` using VAPID.

**Triggers that send pushes:**
- **Partner finishes topic** → Postgres trigger on `topic_progress` inserts a row into a `notification_queue` table; a server endpoint `/api/public/process-notifications` drains the queue and sends pushes. Called by pg_cron every 1 min.
- **Motivational (5×/day)** → pg_cron job at 9am, 12pm, 3pm, 6pm, 9pm IST calls `/api/public/send-motivational` which picks a message based on today's completed-topic count and pushes to all subscribed users.
- **Poke** → server fn `pokeUser(toUserId, message)` inserts poke + sends push immediately.

**Why this works when browser closed:** Service worker receives pushes from the OS push service (FCM/APNS via browser). Works on desktop Chrome/Edge/Firefox. iOS only works if user adds site to home screen as PWA — I'll add a manifest + install prompt.

## 2. Gemini AI Integration

- Store the pasted Gemini API key as `GEMINI_API_KEY` secret (and recommend rotating it since it was shared in chat).
- Server function `analyzeProgress({ userId })` calls Gemini 2.5 Flash with:
  - Completion counts per subject (last 7/30 days)
  - Streaks, pace, partner comparison
  - Returns: strengths, weak areas, suggested focus subjects, motivational summary, predicted completion date for NEET PG goal.
- Server function `analyzeActivity({ userId })` summarizes today's session in 2-3 sentences.

## 3. Analytics Page Redesign

- Hero: AI-generated weekly insight card (gradient clay, big readable summary).
- Subject mastery radar/bar chart (recharts) with claymorphism container.
- Streak calendar heatmap (last 90 days).
- Partner comparison side-by-side: who's ahead per subject, fun "rivalry" framing.
- NEET PG countdown integrated with "at current pace you'll finish X% of syllabus by exam day".
- AI "Coach" panel with suggested next 3 topics to tackle.
- Re-fetch button + auto-refresh on visit.

## 4. Poke Feature

- Button on partner avatar in dashboard + settings.
- Dialog: presets ("Let's study! 📚", "Break's over ⏰", "Topic check-in 🔬", custom textarea).
- Sends push instantly + records in `pokes` table.
- In-app toast on receive + push notification when closed.
- Cooldown: 1 poke per partner per 5 min to prevent spam.

## 5. Visual polish (lighter touch — focus on auth feel)

- Replace remaining "AI-looking" gradients with grounded clay surfaces (warmer palette: cream #FAF6F0, terracotta accent #E8967A).
- Add subtle Aurora background on dashboard hero (from react-bits style — animated SVG blobs).
- Click-spark micro-interaction on topic complete.
- Page transitions already added — tune timing.

## 6. Testing

After build I'll: subscribe to push from the running preview, trigger a partner-topic-complete event via psql, verify the SW receives it, fire a manual motivational push, send a poke, and call the AI analysis endpoint. Only ship after each step passes.

## Technical notes

- pg_cron + pg_net extensions needed for scheduled push sends.
- Motivational schedule stored server-side (not client setInterval) so it fires independent of any open tab.
- All push send endpoints under `/api/public/*` are protected by a shared `CRON_SECRET` header check.
- iOS Safari limitation will be noted in-app for iOS users.
