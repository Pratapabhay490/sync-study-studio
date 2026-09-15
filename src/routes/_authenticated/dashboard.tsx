import { SyncMark } from "@/components/sync-mark";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { computeReadiness, computeUserStats, useData } from "@/lib/data-context";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { UserAvatar } from "@/components/user-avatar";
import { ProgressRing } from "@/components/progress-ring";
import { Activity, ArrowRight, CalendarClock, Pencil, RefreshCw, ShieldCheck } from "lucide-react";
import { ScrollReveal } from "@/components/scroll-reveal";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  differenceInSeconds,
  formatDistanceToNow,
  isToday,
  parseISO,
  startOfDay,
  subDays,
} from "date-fns";
import { ClayVisual } from "@/components/clay-visuals";
import { DashboardSkeleton } from "@/components/skeletons";
import { PokeButton } from "@/components/poke-button";
import { StudyHoursCard } from "@/components/study-hours-card";
import { DailyTaskBoard, todayISO } from "@/components/daily-task-board";
import { WeeklyTaskBoard } from "@/components/weekly-task-board";

import clayTopics from "@/assets/clay-icon-topics.png";
import clayCompleted from "@/assets/clay-icon-completed.png";
import clayProgress from "@/assets/clay-icon-progress.png";
import clayStreak from "@/assets/clay-icon-streak.png";

const DEFAULT_TARGET = {
  label: "NEET PG 2026",
  date: "2026-08-30T09:00:00+05:30",
};

function useCustomTarget(userId?: string, partnerId?: string) {
  const storageKey = userId ? `sync:countdown:${userId}` : null;
  const [local, setLocal] = useState(DEFAULT_TARGET);
  const [synced, setSynced] = useState(false);
  const [remote, setRemote] = useState<{ label: string; date: string } | null>(null);

  // local fallback (per-device, unsynced)
  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.label && parsed?.date) setLocal(parsed);
      }
    } catch {}
  }, [storageKey]);

  const loadRemote = useCallback(async () => {
    if (!userId) return;
    const ids = [userId, partnerId].filter(Boolean) as string[];
    const { data } = await supabase
      .from("profiles")
      .select("id, countdown_label, countdown_date, countdown_sync, countdown_updated_at")
      .in("id", ids);
    const rows = (data ?? []) as any[];
    const mine = rows.find((r) => r.id === userId);
    setSynced(!!mine?.countdown_sync);
    if (mine?.countdown_sync) {
      const shared = rows
        .filter((r) => r.countdown_sync && r.countdown_date)
        .sort(
          (a, b) =>
            new Date(b.countdown_updated_at ?? 0).getTime() -
            new Date(a.countdown_updated_at ?? 0).getTime(),
        )[0];
      setRemote(
        shared
          ? { label: shared.countdown_label || DEFAULT_TARGET.label, date: shared.countdown_date }
          : null,
      );
    } else if (mine?.countdown_date) {
      setRemote({ label: mine.countdown_label || DEFAULT_TARGET.label, date: mine.countdown_date });
    } else {
      setRemote(null);
    }
  }, [userId, partnerId]);

  useEffect(() => {
    loadRemote();
    if (!userId) return;
    const ch = supabase
      .channel(`countdown:${userId}:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, () =>
        loadRemote(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, loadRemote]);

  const target = remote ?? local;

  const save = async (next: { label: string; date: string }) => {
    setRemote(next);
    setLocal(next);
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {}
    }
    if (userId) {
      // RPC keeps the partner in sync when the Sync toggle is on
      await (supabase.rpc as any)("set_countdown", {
        p_label: next.label,
        p_date: new Date(next.date).toISOString(),
      });
      loadRemote();
    }
  };

  const setSync = async (on: boolean) => {
    setSynced(on);
    if (!userId) return;
    // If my countdown only lives on this device, store it first so it can be shared.
    if (on && !remote) {
      await (supabase.rpc as any)("set_countdown", {
        p_label: local.label,
        p_date: new Date(local.date).toISOString(),
      });
    }
    // The RPC keeps an already-set partner countdown instead of overwriting it,
    // and turning sync off switches it off for both partners.
    await (supabase.rpc as any)("set_countdown_sync", { p_on: on });
    loadRemote();
  };



  return { target, save, synced, setSync };
}


function useCountdown(target: Date) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const total = Math.max(0, differenceInSeconds(target, now));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return { days, hours, minutes, seconds, total };
}

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Home — Let's be in sync" }] }),
  component: Dashboard,
});

function readinessLabel(score: number) {
  if (score >= 85) return "exam ready";
  if (score >= 60) return "on track";
  if (score >= 30) return "building up";
  return "just getting started";
}

const QUOTES = [
  "Small steps, every day. That's how you cross MBBS.",
  "Consistency beats intensity. Open one topic now.",
  "Two minds, one rhythm. Keep syncing.",
  "Slow is smooth. Smooth is fast.",
];

function Dashboard() {
  const { user } = useAuth();
  const { profiles, subjects, topics, progress, loading } = useData();
  const me = profiles.find((p) => p.id === user?.id);
  const other = profiles.find((p) => p.id !== user?.id);
  const {
    target,
    save: saveTarget,
    synced,
    setSync,
  } = useCustomTarget(user?.id, other?.id);
  const targetDate = useMemo(() => new Date(target.date), [target.date]);
  const countdown = useCountdown(targetDate);
  const [editingCountdown, setEditingCountdown] = useState(false);


  const myStats = useMemo(
    () => (user ? computeUserStats(user.id, topics, progress) : { total: 0, completed: 0, pct: 0 }),
    [user, topics, progress],
  );
  const otherStats = useMemo(
    () =>
      other ? computeUserStats(other.id, topics, progress) : { total: 0, completed: 0, pct: 0 },
    [other, topics, progress],
  );

  const myReadiness = useMemo(
    () =>
      user
        ? computeReadiness(user.id, topics, progress)
        : { score: 0, completed: 0, revisions: 0, revisionTotal: 0 },
    [user, topics, progress],
  );
  const partnerReadiness = useMemo(
    () =>
      other
        ? computeReadiness(other.id, topics, progress)
        : { score: 0, completed: 0, revisions: 0, revisionTotal: 0 },
    [other, topics, progress],
  );

  const totalTopics = topics.length;
  const totalCompleted = useMemo(
    () => new Set(progress.filter((p) => p.completed).map((p) => p.topic_id)).size,
    [progress],
  );
  const overallPct = totalTopics ? Math.round((totalCompleted / totalTopics) * 100) : 0;
  const pending = totalTopics - totalCompleted;

  // Days where I took part in a focus session — these also count as studying.
  const [focusDays, setFocusDays] = useState<string[]>([]);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("focus_sessions")
        .select("started_at,host_id,partner_id,joined_by_partner")
        .or(`host_id.eq.${user.id},partner_id.eq.${user.id}`)
        .order("started_at", { ascending: false })
        .limit(200);
      if (cancelled || !data) return;
      setFocusDays(
        data
          .filter((s) => s.host_id === user.id || s.joined_by_partner)
          .map((s) => startOfDay(parseISO(s.started_at)).toISOString()),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // streak: consecutive days with a completed topic OR a focus session
  const myStreak = useMemo(() => {
    if (!user) return 0;
    const days = new Set([
      ...progress
        .filter((p) => p.user_id === user.id && p.completed && p.completed_at)
        .map((p) => startOfDay(parseISO(p.completed_at!)).toISOString()),
      ...focusDays,
    ]);
    let streak = 0;
    let day = startOfDay(new Date());
    while (days.has(day.toISOString())) {
      streak++;
      day = subDays(day, 1);
    }
    return streak;
  }, [user, progress, focusDays]);

  const completedToday = useMemo(
    () =>
      user
        ? progress.filter(
            (p) =>
              p.user_id === user.id &&
              p.completed &&
              p.completed_at &&
              isToday(parseISO(p.completed_at)),
          ).length
        : 0,
    [user, progress],
  );

  const recent = useMemo(
    () =>
      progress
        .filter((p) => p.completed && p.completed_at)
        .sort((a, b) => (b.completed_at! > a.completed_at! ? 1 : -1))
        .slice(0, 8),
    [progress],
  );

  const dashboardLookups = useMemo(() => {
    const topicsBySubject = new Map<string, typeof topics>();
    const topicById = new Map(topics.map((topic) => [topic.id, topic]));
    const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));
    const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
    const completedByTopic = new Map<string, number>();
    topics.forEach((topic) => {
      const current = topicsBySubject.get(topic.subject_id);
      if (current) current.push(topic);
      else topicsBySubject.set(topic.subject_id, [topic]);
    });
    progress.forEach((item) => {
      if (item.completed) completedByTopic.set(item.topic_id, (completedByTopic.get(item.topic_id) ?? 0) + 1);
    });
    return { topicsBySubject, topicById, subjectById, profileById, completedByTopic };
  }, [profiles, progress, subjects, topics]);

  const quote = QUOTES[new Date().getDate() % QUOTES.length];

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-5 sm:space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 pb-0 shadow-card md:p-10 md:pb-0">
        <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-gradient-aurora opacity-25 blur-3xl" />
        <div className="pointer-events-none absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-gradient-primary opacity-15 blur-3xl" />
        <div className="relative grid gap-8 lg:grid-cols-[1.15fr_auto_1fr] lg:items-center">
          {/* Left: copy + CTAs */}
          <div className="pb-8 md:pb-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1 text-xs text-muted-foreground">
              <SyncMark className="h-3.5 w-3.5 text-primary" />
              {quote}
            </div>
            <h1 className="mt-4 font-display text-3xl font-bold tracking-tight md:text-5xl">
              Hey {me?.name?.split(" ")[0] ?? "there"},{" "}
              <span className="text-gradient">let's lock in.</span>
            </h1>
            <p className="mt-2 text-sm text-muted-foreground md:text-base">
              {completedToday > 0
                ? `${completedToday} topic${completedToday > 1 ? "s" : ""} done today. Keep it rolling.`
                : "No topics ticked off today yet. Start with one — momentum follows."}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/subjects"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-5 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:scale-[1.02]"
              >
                Open subjects <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/analytics"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold"
              >
                View analytics
              </Link>
            </div>
          </div>

          {/* Center: progress ring with floating sparkles */}
          <div className="relative mx-auto pb-8 md:pb-10">
            <SyncMark
              className="sparkle-twinkle pointer-events-none absolute -left-6 -top-2 h-5 w-5 text-primary/80"
              aria-hidden
            />
            <SyncMark
              className="sparkle-twinkle pointer-events-none absolute -right-4 top-6 h-4 w-4 text-primary/60"
              style={{ animationDelay: "0.8s" }}
              aria-hidden
            />
            <SyncMark
              className="sparkle-twinkle pointer-events-none absolute -bottom-2 left-4 h-4 w-4 text-primary/70"
              style={{ animationDelay: "1.6s" }}
              aria-hidden
            />
            <ProgressRing value={overallPct} size={200} stroke={14}>
              <div className="text-center">
                <div className="font-display text-4xl font-bold">{overallPct}%</div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Combined
                </div>
              </div>
            </ProgressRing>

            {/* Exam readiness */}
            <div className="clay mt-5 w-full max-w-[240px] p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                  Exam readiness
                </span>
                <span className="font-display text-xl font-bold tabular-nums">
                  {myReadiness.score}%
                </span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted shadow-clay-inset">
                <motion.div
                  className="h-full rounded-full bg-gradient-aurora"
                  initial={{ width: 0 }}
                  animate={{ width: `${myReadiness.score}%` }}
                  transition={{ duration: 0.9, ease: "easeOut" }}
                />
              </div>
              <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
                {myStats.completed}/{myStats.total} topics done ·{" "}
                {myReadiness.revisions}/{myReadiness.revisionTotal} revisions ·{" "}
                {readinessLabel(myReadiness.score)}
              </p>
              {other && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {other.name.split(" ")[0]}: {partnerReadiness.score}%
                </p>
              )}
            </div>
          </div>

          {/* Right: clay student anchored to the bottom edge, overlapping the card */}
          <div className="relative hidden h-[280px] lg:block">
            <ClayVisual
              variant="boy"
              priority
              className="clay-character absolute -bottom-2 right-0 w-64"
            />
          </div>
        </div>
        {/* Mobile-only character strip at the bottom */}
        <div className="relative flex justify-center lg:hidden">
          <ClayVisual variant="boy" priority className="clay-character w-44" />
        </div>
      </section>


      {/* Countdown */}
      <ScrollReveal as="section" className="relative overflow-hidden rounded-3xl border border-border bg-card p-4 shadow-card sm:p-6 md:p-8" direction="up">
        <div className="pointer-events-none absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-gradient-primary opacity-15 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-gradient-aurora opacity-20 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[1fr_240px_auto] lg:items-center">
          <div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2">
              <div className="flex min-w-0 items-center gap-2 rounded-xl border border-border bg-background/60 px-2.5 py-1.5 text-xs font-medium text-muted-foreground sm:rounded-full sm:px-3 sm:py-1">
                <CalendarClock className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="min-w-0 truncate">
                  {target.label} ·{" "}
                  {targetDate.toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEditingCountdown((v) => !v)}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-background/60 px-2.5 py-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"
              >
                <Pencil className="h-3 w-3" />
                {editingCountdown ? "Close" : "Edit"}
              </button>
              {other && (
                <button
                  type="button"
                  onClick={() => setSync(!synced)}
                  title={
                    synced
                      ? "Synced with your partner — same countdown for both"
                      : "Turn on to share one countdown with your partner"
                  }
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium transition sm:gap-1.5 sm:px-2.5 ${
                    synced
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border bg-background/60 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <RefreshCw className={`h-3 w-3 ${synced ? "text-primary" : ""}`} />
                  <span className="hidden min-[370px]:inline">Sync</span>
                  <span
                    className={`ml-0.5 flex h-3.5 w-6 items-center rounded-full p-0.5 transition ${
                      synced ? "bg-primary/70" : "bg-muted-foreground/30"
                    }`}
                  >
                    <span
                      className={`h-2.5 w-2.5 rounded-full bg-white shadow transition-transform ${
                        synced ? "translate-x-2.5" : ""
                      }`}
                    />
                  </span>
                </button>
              )}
            </div>

            <h2 className="mt-3 font-display text-2xl font-bold tracking-tight md:text-3xl">
              {countdown.total > 0 ? (
                <>
                  The clock is <span className="text-gradient">ticking.</span>
                </>
              ) : (
                <>
                  It's the day. <span className="text-gradient">All the best!</span>
                </>
              )}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Every topic you tick today is one step closer.
            </p>
            {editingCountdown && (
              <CountdownEditor
                initial={target}
                onSave={(next) => {
                  saveTarget(next);
                  setEditingCountdown(false);
                }}
                onReset={() => {
                  saveTarget(DEFAULT_TARGET);
                  setEditingCountdown(false);
                }}
              />
            )}
          </div>
          <div aria-hidden className="hidden" />
            <div className="grid min-w-0 grid-cols-4 gap-1.5 sm:gap-3">
            <CountdownCell label="Days" value={countdown.days} />
            <CountdownCell label="Hours" value={countdown.hours} />
            <CountdownCell label="Mins" value={countdown.minutes} />
            <CountdownCell label="Secs" value={countdown.seconds} />
          </div>
        </div>
      </ScrollReveal>


      {/* Stat tiles */}
      <ScrollReveal as="section" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" direction="up" delay={60}>
        <StatTile
          clayIcon={clayTopics}
          label="Total topics"
          value={totalTopics}
          accent="bg-gradient-primary"
        />
        <StatTile
          clayIcon={clayCompleted}
          label="Completed"
          value={totalCompleted}
          accent="bg-gradient-abhay"
        />
        <StatTile
          clayIcon={clayProgress}
          label="Pending"
          value={pending}
          accent="bg-gradient-aishwarya"
        />
        <StatTile
          clayIcon={clayStreak}
          label="Your streak"
          value={`${myStreak}d`}
          accent="bg-gradient-aurora"
        />
      </ScrollReveal>

      {/* Focus hours */}
      <ScrollReveal as="section" direction="up" delay={70}>
        <StudyHoursCard me={me} partner={other} />
      </ScrollReveal>



      {/* Side-by-side */}
      <ScrollReveal as="section" className="grid gap-4 md:grid-cols-2" direction="up" delay={80}>
        <UserCard profile={me} stats={myStats} accent="abhay" label="You" />
        <UserCard
          profile={other}
          stats={otherStats}
          accent="aishwarya"
          label="Study partner"
          poke={other ? <PokeButton toUserId={other.id} toName={other.name} /> : null}
        />
      </ScrollReveal>

      {user && (
        <ScrollReveal direction="up" delay={90}>
          <DailyTaskBoard currentUserId={user.id} profiles={profiles} date={todayISO()} showFullBoardLink />
        </ScrollReveal>
      )}

      {user && (
        <ScrollReveal direction="up" delay={95}>
          <WeeklyTaskBoard currentUserId={user.id} profiles={profiles} />
        </ScrollReveal>
      )}

      {/* Subjects + activity */}
      <ScrollReveal as="section" className="cv-section grid gap-4 lg:grid-cols-3" direction="up" delay={100}>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold">Subjects at a glance</h3>
            <Link to="/subjects" className="text-xs font-medium text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {subjects.slice(0, 6).map((s) => {
              const sTopics = dashboardLookups.topicsBySubject.get(s.id) ?? [];
              const sComp = sTopics.reduce(
                (count, topic) => count + (dashboardLookups.completedByTopic.get(topic.id) ?? 0),
                0,
              );
              const total = sTopics.length * Math.max(profiles.length, 1);
              const pct = total ? Math.round((sComp / total) * 100) : 0;
              return (
                <Link
                  key={s.id}
                  to="/subjects/$id"
                  params={{ id: s.id }}
                  className="flex items-center gap-4 rounded-xl border border-border bg-background/50 p-3 transition hover:bg-accent/30"
                >
                  <div className="flex-1">
                    <div className="text-sm font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{sTopics.length} topics</div>
                  </div>
                  <div className="flex w-40 items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-gradient-primary transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-xs font-semibold">{pct}%</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
            <Activity className="h-4 w-4 text-primary" /> Recent activity
          </h3>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No completions yet — start ticking topics!
            </p>
          ) : (
            <ul className="space-y-3">
              {recent.map((p) => {
                const topic = dashboardLookups.topicById.get(p.topic_id);
                const subject = topic ? dashboardLookups.subjectById.get(topic.subject_id) : undefined;
                const who = dashboardLookups.profileById.get(p.user_id);
                return (
                  <li key={p.id} className="flex items-start gap-3">
                    <UserAvatar profile={who} size={28} />
                    <div className="min-w-0 flex-1 text-sm">
                      <div className="truncate">
                        <span className="font-semibold">
                          {who?.name?.split(" ")[0] ?? "Someone"}
                        </span>
                        <span className="text-muted-foreground"> finished </span>
                        <span className="font-medium">{topic?.topic_name}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {subject?.name} ·{" "}
                        {p.completed_at
                          ? formatDistanceToNow(parseISO(p.completed_at), { addSuffix: true })
                          : ""}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </ScrollReveal>
    </div>
  );
}

function StatTile({
  clayIcon,
  label,
  value,
  accent,
}: {
  clayIcon: string;
  label: string;
  value: number | string;
  accent: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-glow">
      <div
        className={`absolute -right-8 -top-8 h-24 w-24 rounded-full ${accent} opacity-20 blur-2xl transition group-hover:opacity-40`}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="mt-1 font-display text-3xl font-bold">{value}</div>
        </div>
        <img
          src={clayIcon}
          alt=""
          aria-hidden
          width={512}
          height={512}
          loading="lazy"
          className="h-14 w-14 shrink-0 -translate-y-1 drop-shadow-md transition group-hover:scale-110 group-hover:rotate-[-4deg]"
        />
      </div>
    </div>
  );
}

function UserCard({
  profile,
  stats,
  accent,
  label,
  poke,
}: {
  profile?: { id: string; name: string; email: string; avatar_url: string | null } | null;
  stats: { total: number; completed: number; pct: number };
  accent: "abhay" | "aishwarya";
  label: string;
  poke?: React.ReactNode;
}) {
  const grad = accent === "abhay" ? "bg-gradient-abhay" : "bg-gradient-aishwarya";
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-card">
      <div
        className={`pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full ${grad} opacity-20 blur-3xl`}
      />
      <div className="relative flex items-center gap-4">
        <UserAvatar profile={profile as never} size={56} ring />
        <div className="flex-1">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="font-display text-xl font-semibold">
            {profile?.name ?? "Waiting to join…"}
          </div>
        </div>
        <ProgressRing
          value={stats.pct}
          size={88}
          stroke={8}
          gradientId={`ring-${accent}`}
          gradientFrom={accent === "abhay" ? "oklch(0.62 0.2 250)" : "oklch(0.68 0.2 340)"}
          gradientTo={accent === "abhay" ? "oklch(0.55 0.22 275)" : "oklch(0.6 0.22 305)"}
        >
          <div className="font-display text-lg font-bold">{stats.pct}%</div>
        </ProgressRing>
      </div>
      <div className="relative mt-5 grid grid-cols-3 gap-3 text-center">
        <Tile label="Done" value={stats.completed} />
        <Tile label="Pending" value={stats.total - stats.completed} />
        <Tile label="Total" value={stats.total} />
      </div>
      {poke && <div className="relative mt-4 flex justify-end">{poke}</div>}
    </div>
  );
}

function CountdownEditor({
  initial,
  onSave,
  onReset,
}: {
  initial: { label: string; date: string };
  onSave: (next: { label: string; date: string }) => void;
  onReset: () => void;
}) {
  const initialLocal = useMemo(() => {
    const d = new Date(initial.date);
    if (isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, [initial.date]);
  const [label, setLabel] = useState(initial.label);
  const [dateLocal, setDateLocal] = useState(initialLocal);

  const handleSave = () => {
    if (!label.trim() || !dateLocal) return;
    const iso = new Date(dateLocal).toISOString();
    onSave({ label: label.trim(), date: iso });
  };

  return (
    <div className="mt-4 flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-background/60 p-3 sm:flex-row sm:items-end sm:p-4">
      <div className="flex-1">
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Event name
        </label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. NEET PG 2026"
          className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>
      <div className="flex-1">
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Date & time
        </label>
        <input
          type="datetime-local"
          value={dateLocal}
          onChange={(e) => setDateLocal(e.target.value)}
          className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex">
        <button
          type="button"
          onClick={handleSave}
          className="rounded-xl bg-gradient-primary px-4 py-2 text-sm font-semibold text-white shadow-glow"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onReset}
          className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

function CountdownCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-background/70 px-1 py-2.5 text-center shadow-card backdrop-blur sm:min-w-[80px] sm:rounded-2xl sm:px-4 sm:py-4">
      <div className="font-display text-xl font-bold tabular-nums min-[370px]:text-2xl sm:text-4xl">
        {String(value).padStart(2, "0")}
      </div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground sm:text-xs">
        {label}
      </div>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-background/50 p-3">
      <div className="font-display text-lg font-bold">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-48 animate-pulse rounded-3xl bg-card" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-card" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-48 animate-pulse rounded-2xl bg-card" />
        <div className="h-48 animate-pulse rounded-2xl bg-card" />
      </div>
    </div>
  );
}
