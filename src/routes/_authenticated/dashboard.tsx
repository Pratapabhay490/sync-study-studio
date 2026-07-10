import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { computeUserStats, useData } from "@/lib/data-context";
import { UserAvatar } from "@/components/user-avatar";
import { ProgressRing } from "@/components/progress-ring";
import {
  Activity,
  ArrowRight,
  CalendarClock,
  Pencil,
  Sparkles,
} from "lucide-react";
import { ScrollReveal } from "@/components/scroll-reveal";
import { useEffect, useMemo, useState } from "react";
import {
  differenceInSeconds,
  formatDistanceToNow,
  isToday,
  parseISO,
  startOfDay,
  subDays,
} from "date-fns";
import { ClayLoader, ClayVisual } from "@/components/clay-visuals";
import { PokeButton } from "@/components/poke-button";
import clayTopics from "@/assets/clay-icon-topics.png";
import clayCompleted from "@/assets/clay-icon-completed.png";
import clayProgress from "@/assets/clay-icon-progress.png";
import clayStreak from "@/assets/clay-icon-streak.png";

const DEFAULT_TARGET = {
  label: "NEET PG 2026",
  date: "2026-08-30T09:00:00+05:30",
};

function useCustomTarget(userId?: string) {
  const storageKey = userId ? `sync:countdown:${userId}` : null;
  const [target, setTarget] = useState(DEFAULT_TARGET);
  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.label && parsed?.date) setTarget(parsed);
      }
    } catch {}
  }, [storageKey]);
  const save = (next: { label: string; date: string }) => {
    setTarget(next);
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {}
    }
  };
  return { target, save };
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
  head: () => ({ meta: [{ title: "Dashboard — Let's be in sync" }] }),
  component: Dashboard,
});

const QUOTES = [
  "Small steps, every day. That's how you cross MBBS.",
  "Consistency beats intensity. Open one topic now.",
  "Two minds, one rhythm. Keep syncing.",
  "Slow is smooth. Smooth is fast.",
];

function Dashboard() {
  const { user } = useAuth();
  const { profiles, subjects, topics, progress, loading } = useData();
  const { target, save: saveTarget } = useCustomTarget(user?.id);
  const targetDate = useMemo(() => new Date(target.date), [target.date]);
  const countdown = useCountdown(targetDate);
  const [editingCountdown, setEditingCountdown] = useState(false);

  const me = profiles.find((p) => p.id === user?.id);
  const other = profiles.find((p) => p.id !== user?.id);

  const myStats = useMemo(
    () => (user ? computeUserStats(user.id, topics, progress) : { total: 0, completed: 0, pct: 0 }),
    [user, topics, progress],
  );
  const otherStats = useMemo(
    () =>
      other ? computeUserStats(other.id, topics, progress) : { total: 0, completed: 0, pct: 0 },
    [other, topics, progress],
  );

  const totalTopics = topics.length;
  const totalCompleted = useMemo(
    () => new Set(progress.filter((p) => p.completed).map((p) => p.topic_id)).size,
    [progress],
  );
  const overallPct = totalTopics ? Math.round((totalCompleted / totalTopics) * 100) : 0;
  const pending = totalTopics - totalCompleted;

  // streak: count consecutive days from today where user has any completion
  const myStreak = useMemo(() => {
    if (!user) return 0;
    const days = new Set(
      progress
        .filter((p) => p.user_id === user.id && p.completed && p.completed_at)
        .map((p) => startOfDay(parseISO(p.completed_at!)).toISOString()),
    );
    let streak = 0;
    let day = startOfDay(new Date());
    while (days.has(day.toISOString())) {
      streak++;
      day = subDays(day, 1);
    }
    return streak;
  }, [user, progress]);

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

  const quote = QUOTES[new Date().getDate() % QUOTES.length];

  if (loading) {
    return <ClayLoader label="Building your clay dashboard" />;
  }

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 pb-0 shadow-card md:p-10 md:pb-0">
        <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-gradient-aurora opacity-25 blur-3xl" />
        <div className="pointer-events-none absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-gradient-primary opacity-15 blur-3xl" />
        <div className="relative grid gap-8 lg:grid-cols-[1.15fr_auto_1fr] lg:items-center">
          {/* Left: copy + CTAs */}
          <div className="pb-8 md:pb-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
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
            <Sparkles
              className="sparkle-twinkle pointer-events-none absolute -left-6 -top-2 h-5 w-5 text-primary/80"
              aria-hidden
            />
            <Sparkles
              className="sparkle-twinkle pointer-events-none absolute -right-4 top-6 h-4 w-4 text-primary/60"
              style={{ animationDelay: "0.8s" }}
              aria-hidden
            />
            <Sparkles
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


      {/* NEET PG Countdown */}
      <ScrollReveal as="section" className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-card md:p-8" direction="up">
        <div className="pointer-events-none absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-gradient-primary opacity-15 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-gradient-aurora opacity-20 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[1fr_240px_auto] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5 text-primary" />
              NEET PG 2026 · 30 August 2026
            </div>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-tight md:text-3xl">
              {countdown.total > 0 ? (
                <>
                  The clock is <span className="text-gradient">ticking.</span>
                </>
              ) : (
                <>
                  It's exam day. <span className="text-gradient">All the best!</span>
                </>
              )}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Every topic you tick today is one step closer.
            </p>
          </div>
          <div aria-hidden className="hidden" />
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
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

      {/* Subjects + activity */}
      <ScrollReveal as="section" className="grid gap-4 lg:grid-cols-3" direction="up" delay={100}>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold">Subjects at a glance</h3>
            <Link to="/subjects" className="text-xs font-medium text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {subjects.slice(0, 6).map((s) => {
              const sTopics = topics.filter((t) => t.subject_id === s.id);
              const sComp = progress.filter(
                (p) => p.completed && sTopics.some((t) => t.id === p.topic_id),
              ).length;
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
                const topic = topics.find((t) => t.id === p.topic_id);
                const subject = subjects.find((s) => s.id === topic?.subject_id);
                const who = profiles.find((u) => u.id === p.user_id);
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

function CountdownCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-[64px] rounded-2xl border border-border bg-background/70 px-3 py-3 text-center shadow-card backdrop-blur sm:min-w-[80px] sm:px-4 sm:py-4">
      <div className="font-display text-2xl font-bold tabular-nums sm:text-4xl">
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
