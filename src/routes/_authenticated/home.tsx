import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { computeUserStats, useData } from "@/lib/data-context";
import { UserAvatar } from "@/components/user-avatar";
import { ProgressRing } from "@/components/progress-ring";
import { ScrollReveal } from "@/components/scroll-reveal";
import { PokeButton } from "@/components/poke-button";
import { CheckinModal } from "@/components/checkin-modal";
import { FocusSessionCard } from "@/components/focus-session-card";
import { ReactionBar } from "@/components/reaction-bar";
import {
  usePresence,
  usePresenceHeartbeat,
  statusDot,
  useTodayCheckins,
  useActiveFocusSession,
} from "@/lib/partner";
import { useXpFor } from "@/lib/xp";
import { XpBar } from "@/components/xp-bar";
import { StreakFlame } from "@/components/streak-flame";
import { WeeklyChallengeCard } from "@/components/weekly-challenge-card";
import { StudyTree } from "@/components/study-tree";
import { BadgeShelf } from "@/components/badge-shelf";
import { PartnerMascot } from "@/components/partner-mascot";
import { differenceInCalendarDays, formatDistanceToNow, isToday, parseISO, startOfDay, subDays } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Sparkles, Flame, Users, Heart, BookOpen, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({ meta: [{ title: "Home — Let's be in sync" }] }),
  component: PartnerHome,
});

function PartnerHome() {
  const { user } = useAuth();
  const { profiles, subjects, topics, progress } = useData();
  usePresenceHeartbeat("online");

  const me = profiles.find((p) => p.id === user?.id);
  const other = profiles.find((p) => p.id !== user?.id);
  const userIds = useMemo(() => [me?.id, other?.id].filter(Boolean) as string[], [me, other]);
  const presence = usePresence(userIds);
  const checkins = useTodayCheckins(userIds);
  const focusSession = useActiveFocusSession(userIds);
  const xp = useXpFor(userIds);
  const myXp = user ? xp[user.id] : undefined;
  const otherXp = other ? xp[other.id] : undefined;
  const combinedWeeklyXp = (myXp?.total_xp ?? 0) + (otherXp?.total_xp ?? 0);

  // Trigger streak refresh on mount (server updates together_streaks table)
  useEffect(() => {
    if (!other) return;
    supabase.rpc("refresh_together_streak").then(() => {});
  }, [other?.id]);

  const myStats = user ? computeUserStats(user.id, topics, progress) : { pct: 0, completed: 0, total: 0 };
  const otherStats = other ? computeUserStats(other.id, topics, progress) : { pct: 0, completed: 0, total: 0 };

  const myCheckin = user ? checkins[user.id] : null;
  const otherCheckin = other ? checkins[other.id] : null;

  const completedToday = useMemo(
    () =>
      progress.filter(
        (p) => p.completed && p.completed_at && isToday(parseISO(p.completed_at)),
      ).length,
    [progress],
  );

  const myStreak = useMemo(() => {
    if (!user) return 0;
    const days = new Set(
      progress
        .filter((p) => p.user_id === user.id && p.completed && p.completed_at)
        .map((p) => startOfDay(parseISO(p.completed_at!)).toISOString()),
    );
    let s = 0;
    let d = startOfDay(new Date());
    while (days.has(d.toISOString())) {
      s++;
      d = subDays(d, 1);
    }
    return s;
  }, [user, progress]);

  const otherStreak = useMemo(() => {
    if (!other) return 0;
    const days = new Set(
      progress
        .filter((p) => p.user_id === other.id && p.completed && p.completed_at)
        .map((p) => startOfDay(parseISO(p.completed_at!)).toISOString()),
    );
    let s = 0;
    let d = startOfDay(new Date());
    while (days.has(d.toISOString())) {
      s++;
      d = subDays(d, 1);
    }
    return s;
  }, [other, progress]);

  const sharedStreak = useMemo(() => {
    if (!user || !other) return 0;
    const daysA = new Set(
      progress.filter((p) => p.user_id === user.id && p.completed && p.completed_at)
        .map((p) => startOfDay(parseISO(p.completed_at!)).toISOString()),
    );
    const daysB = new Set(
      progress.filter((p) => p.user_id === other.id && p.completed && p.completed_at)
        .map((p) => startOfDay(parseISO(p.completed_at!)).toISOString()),
    );
    let s = 0;
    let d = startOfDay(new Date());
    while (daysA.has(d.toISOString()) && daysB.has(d.toISOString())) {
      s++;
      d = subDays(d, 1);
    }
    return s;
  }, [user, other, progress]);

  const weekAgo = subDays(new Date(), 7);
  const daysTogetherThisWeek = useMemo(() => {
    if (!user || !other) return 0;
    const daysA = new Set<string>();
    const daysB = new Set<string>();
    for (const p of progress) {
      if (!p.completed || !p.completed_at) continue;
      const d = parseISO(p.completed_at);
      if (d < weekAgo) continue;
      const key = startOfDay(d).toISOString();
      if (p.user_id === user.id) daysA.add(key);
      if (p.user_id === other.id) daysB.add(key);
    }
    let n = 0;
    daysA.forEach((k) => { if (daysB.has(k)) n++; });
    return n;
  }, [user, other, progress, weekAgo]);

  const combinedTopicsWeek = useMemo(
    () =>
      progress.filter(
        (p) => p.completed && p.completed_at && parseISO(p.completed_at) >= weekAgo,
      ).length,
    [progress, weekAgo],
  );

  // Continue where you left off
  const lastMine = useMemo(() => {
    if (!user) return null;
    const rows = progress
      .filter((p) => p.user_id === user.id && p.completed_at)
      .sort((a, b) => (b.completed_at! > a.completed_at! ? 1 : -1));
    const last = rows[0];
    if (!last) return null;
    const topic = topics.find((t) => t.id === last.topic_id);
    if (!topic) return null;
    const subject = subjects.find((s) => s.id === topic.subject_id);
    return { topic, subject, when: last.completed_at };
  }, [user, progress, topics, subjects]);

  // Activity feed (topics + reactions + checkins)
  const [feed, setFeed] = useState<any[]>([]);
  useEffect(() => {
    if (!userIds.length) return;
    let live = true;
    const load = async () => {
      const [{ data: rx }, { data: ck }] = await Promise.all([
        supabase.from("reactions").select("*").in("to_user", userIds).order("created_at", { ascending: false }).limit(10),
        supabase.from("daily_checkins").select("*").in("user_id", userIds).order("updated_at", { ascending: false }).limit(6),
      ]);
      const items: any[] = [];
      for (const p of progress) {
        if (p.completed && p.completed_at) items.push({ type: "topic", at: p.completed_at, row: p });
      }
      for (const r of rx ?? []) items.push({ type: "reaction", at: r.created_at, row: r });
      for (const c of ck ?? []) {
        if (c.morning_at) items.push({ type: "morning", at: c.morning_at, row: c });
        if (c.night_at) items.push({ type: "night", at: c.night_at, row: c });
      }
      items.sort((a, b) => (b.at > a.at ? 1 : -1));
      if (live) setFeed(items.slice(0, 12));
    };
    load();
    const ch = supabase
      .channel("home-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "reactions" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_checkins" }, load)
      .subscribe();
    return () => {
      live = false;
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIds.join(","), progress]);

  const partnerIdle = other
    ? (() => {
        const rows = progress
          .filter((p) => p.user_id === other.id && p.completed_at)
          .sort((a, b) => (b.completed_at! > a.completed_at! ? 1 : -1));
        if (!rows.length) return null;
        return differenceInCalendarDays(new Date(), parseISO(rows[0].completed_at!));
      })()
    : null;

  return (
    <div className="space-y-6 md:space-y-8">
      <CheckinModal />

      {/* Partner header */}
      <ScrollReveal as="section" className="clay relative overflow-hidden p-6 md:p-8" direction="up">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gradient-aurora opacity-25 blur-3xl" />
        <div className="pointer-events-none absolute -left-24 bottom-0 h-64 w-64 rounded-full bg-gradient-primary opacity-20 blur-3xl" />
        <div className="relative flex flex-col gap-6">
          <div className="inline-flex items-center gap-2 self-start rounded-full border border-border bg-background/60 px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" /> You two, together
          </div>
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-center">
            <PartnerBadge profile={me} status={presence[me?.id ?? ""]} label="You" />
            <div className="text-2xl">💫</div>
            <PartnerBadge profile={other} status={presence[other?.id ?? ""]} label="Your partner" fallback="Add a study partner in Settings" />
          </div>

          {/* XP + streak strip */}
          <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
            <div className="clay-pressed p-4">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Your progress
              </div>
              <XpBar xp={myXp?.total_xp ?? 0} />
            </div>
            <div className="flex justify-center">
              <StreakFlame days={sharedStreak} />
            </div>
            <div className="clay-pressed p-4">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {other?.name?.split(" ")[0] ?? "Partner"}'s progress
              </div>
              <XpBar xp={otherXp?.total_xp ?? 0} />
            </div>
          </div>

          <div className="mx-auto max-w-2xl text-center">
            <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
              {completedToday > 0 ? (
                <>You've knocked out {completedToday} today — <span className="text-gradient">keep the rhythm going.</span></>
              ) : (
                <>Hey {me?.name?.split(" ")[0] ?? "there"} — <span className="text-gradient">let's make today count together.</span></>
              )}
            </h1>
          </div>


          {/* Quick actions */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {other && <PokeButton toUserId={other.id} toName={other.name} compact />}
            <Link to="/subjects" className="clay inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold">
              <BookOpen className="h-4 w-4" /> Open subjects
            </Link>
            <Link to="/practice" className="clay inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold">
              <Trophy className="h-4 w-4" /> Practice quiz
            </Link>
          </div>
        </div>
      </ScrollReveal>

      {/* Today's shared goal + dual rings */}
      <div className="grid gap-6 md:grid-cols-2">
        <ScrollReveal className="clay p-6" direction="up">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-display text-lg font-bold">Today, together</h2>
            <span className="text-xs text-muted-foreground">{new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}</span>
          </div>
          <div className="mt-4 space-y-3">
            <CheckinRow profile={me} label="Your goal" checkin={myCheckin} isMe />
            <CheckinRow profile={other} label={`${other?.name?.split(" ")[0] ?? "Partner"}'s goal`} checkin={otherCheckin} />
          </div>
          <div className="mt-5 rounded-2xl bg-muted/40 p-4">
            <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Shared progress today</span>
              <span>{completedToday} topic{completedToday === 1 ? "" : "s"}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-background">
              <div className="h-full bg-gradient-primary transition-all" style={{ width: `${Math.min(100, completedToday * 10)}%` }} />
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal className="clay p-6" direction="up" delay={80}>
          <h2 className="font-display text-lg font-bold">Progress side by side</h2>
          <div className="mt-4 flex items-center justify-around gap-4">
            <div className="text-center">
              <ProgressRing value={myStats.pct} size={130} stroke={12} gradientId="ring-me" gradientFrom="var(--abhay)" gradientTo="var(--abhay-light, var(--abhay))">
                <div>
                  <div className="font-display text-2xl font-bold">{myStats.pct}%</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">You</div>
                </div>
              </ProgressRing>
              <div className="mt-2 text-xs font-semibold">{me?.name?.split(" ")[0] ?? "You"}</div>
              <div className="text-[11px] text-muted-foreground">{myStats.completed}/{myStats.total} topics</div>
            </div>
            <div className="text-center">
              <ProgressRing value={otherStats.pct} size={130} stroke={12} gradientId="ring-them" gradientFrom="var(--aishwarya)" gradientTo="var(--aishwarya-light, var(--aishwarya))">
                <div>
                  <div className="font-display text-2xl font-bold">{otherStats.pct}%</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Them</div>
                </div>
              </ProgressRing>
              <div className="mt-2 text-xs font-semibold">{other?.name?.split(" ")[0] ?? "Partner"}</div>
              <div className="text-[11px] text-muted-foreground">{otherStats.completed}/{otherStats.total} topics</div>
            </div>
          </div>
        </ScrollReveal>
      </div>

      {/* Focus session + Reactions */}
      <div className="grid gap-6 md:grid-cols-[1.3fr_1fr]">
        <ScrollReveal direction="up"><FocusSessionCard session={focusSession} partnerId={other?.id ?? null} partnerName={other?.name} /></ScrollReveal>
        <ScrollReveal direction="up" delay={80}>
          <div className="space-y-4">
            <ReactionBar toUserId={other?.id} toName={other?.name} />
            {lastMine && (
              <Link to="/subjects/$id" params={{ id: lastMine.subject?.id ?? "" }} className="clay flex items-center gap-3 p-4 transition hover:-translate-y-0.5">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-primary text-white">
                  <ArrowRight className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Continue where you left off</div>
                  <div className="truncate text-sm font-semibold">{lastMine.topic.topic_name}</div>
                  <div className="truncate text-xs text-muted-foreground">{lastMine.subject?.name}</div>
                </div>
              </Link>
            )}
            {partnerIdle !== null && partnerIdle >= 2 && other && (
              <div className="clay p-4">
                <div className="flex items-start gap-3">
                  <Heart className="mt-0.5 h-4 w-4 text-rose-400" />
                  <div className="text-sm">
                    <div className="font-semibold">{other.name.split(" ")[0]} has been quiet for {partnerIdle} day{partnerIdle > 1 ? "s" : ""}.</div>
                    <div className="text-xs text-muted-foreground">Send a warm nudge — no pressure, just love.</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollReveal>
      </div>

      {/* Team stats */}
      <ScrollReveal className="clay p-6" direction="up">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Team stats — this week</h2>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Users className="h-3.5 w-3.5" /> together, not vs.</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <TeamStat icon={<Flame className="h-4 w-4 text-orange-400" />} label="Shared streak" value={`${sharedStreak}d`} caption="both studied on the same day" />
          <TeamStat icon={<Users className="h-4 w-4 text-primary" />} label="Days studied together" value={`${daysTogetherThisWeek}`} caption="of the last 7" />
          <TeamStat icon={<BookOpen className="h-4 w-4 text-emerald-500" />} label="Topics finished (both)" value={`${combinedTopicsWeek}`} caption="combined this week" />
          <TeamStat icon={<Flame className="h-4 w-4 text-rose-400" />} label="Individual streaks" value={`${myStreak} · ${otherStreak}`} caption="you · partner" />
        </div>
      </ScrollReveal>

      {/* Weekly challenge + tree */}
      <div className="grid gap-6 md:grid-cols-[1fr_1fr]">
        <ScrollReveal direction="up"><WeeklyChallengeCard partnerId={other?.id ?? null} /></ScrollReveal>
        <ScrollReveal direction="up" delay={80}><StudyTree xp={combinedWeeklyXp} together={sharedStreak} /></ScrollReveal>
      </div>

      {/* Badge shelf */}
      <ScrollReveal direction="up">
        <BadgeShelf userIds={userIds} />
      </ScrollReveal>

      {/* Activity feed */}
      <ScrollReveal className="clay p-6" direction="up">
        <h2 className="mb-4 font-display text-lg font-bold">Recent activity</h2>
        {feed.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing yet today — one small step will show up here 🌱</p>
        ) : (
          <ul className="space-y-3">
            {feed.map((item, i) => (
              <FeedItem key={i} item={item} profiles={profiles} topics={topics} subjects={subjects} />
            ))}
          </ul>
        )}
      </ScrollReveal>
    </div>
  );
}

function PartnerBadge({ profile, status, label, fallback }: any) {
  const dot = statusDot(status?.status ?? "offline", status?.updated_at);
  if (!profile) {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="grid h-20 w-20 place-items-center rounded-full border-2 border-dashed border-border text-2xl text-muted-foreground">?</div>
        <div className="text-xs text-muted-foreground">{fallback ?? "No partner yet"}</div>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <UserAvatar profile={profile} size={80} ring />
        <span className={`absolute bottom-1 right-1 grid h-5 w-5 place-items-center rounded-full ring-2 ring-background ${dot.color}`}>
          <span className="h-2 w-2 rounded-full bg-white/40" />
        </span>
      </div>
      <div className="text-center">
        <div className="text-sm font-bold">{profile.name?.split(" ")[0] ?? label}</div>
        <div className="text-[11px] text-muted-foreground">
          {dot.label}
          {status?.current_activity ? ` · ${status.current_activity}` : ""}
        </div>
      </div>
    </div>
  );
}

function CheckinRow({ profile, label, checkin, isMe }: any) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-background/40 p-3">
      <UserAvatar profile={profile} size={32} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
          {checkin?.night_at && (
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-500">
              {checkin.night_status === "yes" ? "hit ✅" : checkin.night_status === "partial" ? "partly 🌱" : "wrapped 🌙"}
            </span>
          )}
        </div>
        <div className="mt-0.5 truncate text-sm font-medium">
          {checkin?.morning_goal ?? (isMe ? "Set your goal for today ↗" : "No goal set yet")}
        </div>
        {checkin?.planned_minutes ? (
          <div className="text-[11px] text-muted-foreground">Planned ~{checkin.planned_minutes} min</div>
        ) : null}
      </div>
    </div>
  );
}

function TeamStat({ icon, label, value, caption }: any) {
  return (
    <div className="rounded-2xl border border-border bg-background/40 p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-2 font-display text-2xl font-bold">{value}</div>
      <div className="text-[11px] text-muted-foreground">{caption}</div>
    </div>
  );
}

function FeedItem({ item, profiles, topics, subjects }: any) {
  const when = item.at ? formatDistanceToNow(parseISO(item.at), { addSuffix: true }) : "";
  if (item.type === "topic") {
    const p = item.row;
    const topic = topics.find((t: any) => t.id === p.topic_id);
    const subject = subjects.find((s: any) => s.id === topic?.subject_id);
    const who = profiles.find((u: any) => u.id === p.user_id);
    return (
      <li className="flex items-start gap-3">
        <UserAvatar profile={who} size={28} />
        <div className="min-w-0 flex-1 text-sm">
          <div className="truncate">
            <span className="font-semibold">{who?.name?.split(" ")[0] ?? "Someone"}</span>
            <span className="text-muted-foreground"> finished </span>
            <span className="font-medium">{topic?.topic_name ?? "a topic"}</span>
          </div>
          <div className="text-xs text-muted-foreground">{subject?.name} · {when}</div>
        </div>
      </li>
    );
  }
  if (item.type === "reaction") {
    const r = item.row;
    const who = profiles.find((u: any) => u.id === r.from_user);
    const to = profiles.find((u: any) => u.id === r.to_user);
    return (
      <li className="flex items-start gap-3">
        <UserAvatar profile={who} size={28} />
        <div className="min-w-0 flex-1 text-sm">
          <div className="truncate">
            <span className="font-semibold">{who?.name?.split(" ")[0] ?? "Someone"}</span>
            <span className="text-muted-foreground"> sent a </span>
            <span className="font-medium">{r.kind.replace("_", " ")}</span>
            <span className="text-muted-foreground"> to </span>
            <span className="font-medium">{to?.name?.split(" ")[0] ?? "you"}</span>
          </div>
          <div className="text-xs text-muted-foreground">{when}</div>
        </div>
      </li>
    );
  }
  const c = item.row;
  const who = profiles.find((u: any) => u.id === c.user_id);
  return (
    <li className="flex items-start gap-3">
      <UserAvatar profile={who} size={28} />
      <div className="min-w-0 flex-1 text-sm">
        <div className="truncate">
          <span className="font-semibold">{who?.name?.split(" ")[0] ?? "Someone"}</span>
          <span className="text-muted-foreground">
            {item.type === "morning" ? " set a goal — " : " wrapped up the day — "}
          </span>
          <span className="font-medium">
            {item.type === "morning" ? (c.morning_goal ?? "today's goal") : (c.night_status === "yes" ? "hit the goal ✅" : c.night_status === "partial" ? "partial 🌱" : "wrapped 🌙")}
          </span>
        </div>
        <div className="text-xs text-muted-foreground">{when}</div>
      </div>
    </li>
  );
}
