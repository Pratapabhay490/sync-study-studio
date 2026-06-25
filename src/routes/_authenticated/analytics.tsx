import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useData } from "@/lib/data-context";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, LineChart, Line,
  CartesianGrid, Legend, RadialBarChart, RadialBar, PolarAngleAxis,
} from "recharts";
import { parseISO, startOfDay, subDays, format, isToday, isThisWeek } from "date-fns";
import { Sparkles, RefreshCcw, Flame, Trophy, Target, Brain, TrendingUp, AlertTriangle, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Let's be in sync" }] }),
  component: AnalyticsPage,
});

interface AIInsight {
  headline?: string;
  summary?: string;
  bullets?: string[];
  next_actions?: string[];
}

function AnalyticsPage() {
  const { subjects, topics, progress, profiles } = useData();
  const { user } = useAuth();

  const me = profiles.find((p) => p.id === user?.id);
  const partner = profiles.find((p) => p.id !== user?.id);

  // ---------- derived stats ----------
  const stats = useMemo(() => {
    const mk = (uid?: string) => {
      if (!uid) return { done: 0, today: 0, week: 0, streak: 0, pct: 0 };
      const mine = progress.filter((p) => p.user_id === uid && p.completed);
      const done = mine.length;
      const today = mine.filter((p) => p.completed_at && isToday(parseISO(p.completed_at))).length;
      const week = mine.filter((p) => p.completed_at && isThisWeek(parseISO(p.completed_at))).length;
      const days = new Set(mine.filter((p) => p.completed_at).map((p) => startOfDay(parseISO(p.completed_at!)).toISOString()));
      let streak = 0;
      let day = startOfDay(new Date());
      while (days.has(day.toISOString())) { streak++; day = subDays(day, 1); }
      const pct = topics.length ? Math.round((done / topics.length) * 100) : 0;
      return { done, today, week, streak, pct };
    };
    return { me: mk(user?.id), partner: mk(partner?.id) };
  }, [user, partner, progress, topics]);

  const bySubject = useMemo(() =>
    subjects.map((s) => {
      const sTopics = topics.filter((t) => t.subject_id === s.id);
      const row: Record<string, string | number> = { name: s.name, total: sTopics.length };
      profiles.forEach((p) => {
        row[p.name.split(" ")[0]] = progress.filter(
          (pr) => pr.user_id === p.id && pr.completed && sTopics.some((t) => t.id === pr.topic_id),
        ).length;
      });
      return row;
    }), [subjects, topics, progress, profiles]);

  const weekly = useMemo(() => {
    const days = Array.from({ length: 14 }).map((_, i) => startOfDay(subDays(new Date(), 13 - i)));
    return days.map((d) => {
      const row: Record<string, string | number> = { day: format(d, "MMM d") };
      profiles.forEach((p) => {
        row[p.name.split(" ")[0]] = progress.filter(
          (pr) => pr.user_id === p.id && pr.completed && pr.completed_at &&
            startOfDay(parseISO(pr.completed_at)).getTime() === d.getTime(),
        ).length;
      });
      return row;
    });
  }, [progress, profiles]);

  const rankings = useMemo(() => {
    const arr = subjects.map((s) => {
      const sTopics = topics.filter((t) => t.subject_id === s.id);
      const done = progress.filter((p) => p.completed && sTopics.some((t) => t.id === p.topic_id)).length;
      const denom = Math.max(1, sTopics.length * Math.max(1, profiles.length));
      const pct = Math.round((done / denom) * 100);
      return { name: s.name, pct, total: sTopics.length };
    });
    return {
      top: [...arr].sort((a, b) => b.pct - a.pct).slice(0, 5),
      bottom: [...arr].filter((x) => x.total > 0).sort((a, b) => a.pct - b.pct).slice(0, 5),
    };
  }, [subjects, topics, profiles, progress]);

  // ---------- AI insights ----------
  const [insight, setInsight] = useState<AIInsight | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const fetchInsights = async () => {
    setLoadingAI(true);
    setAiError(null);
    try {
      const payload = {
        you: { name: me?.name, ...stats.me },
        partner: { name: partner?.name, ...stats.partner },
        total_topics: topics.length,
        total_subjects: subjects.length,
        top_subjects: rankings.top.slice(0, 5),
        weak_subjects: rankings.bottom.slice(0, 5),
        last_7_days: weekly.slice(-7),
      };
      const { data, error } = await supabase.functions.invoke("gemini-analyze", {
        body: { kind: "insights", payload },
      });
      if (error) throw error;
      setInsight(data as AIInsight);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Could not reach AI coach.");
    } finally {
      setLoadingAI(false);
    }
  };

  useEffect(() => {
    if (subjects.length && profiles.length) fetchInsights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjects.length, profiles.length]);

  const radial = [
    { name: me?.name?.split(" ")[0] ?? "You", value: stats.me.pct, fill: "var(--abhay, #6366f1)" },
    { name: partner?.name?.split(" ")[0] ?? "Partner", value: stats.partner.pct, fill: "var(--aishwarya, #ec4899)" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground shadow-clay-sm">
            <Brain className="h-3.5 w-3.5 text-primary" /> Powered by Gemini
          </div>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight md:text-4xl">
            Your study, <span className="text-gradient">analysed.</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live progress, pattern detection, and AI-coached next steps for both of you.
          </p>
        </div>
        <Button onClick={fetchInsights} disabled={loadingAI} className="shadow-clay-sm">
          <RefreshCcw className={`mr-2 h-4 w-4 ${loadingAI ? "animate-spin" : ""}`} />
          {loadingAI ? "Thinking…" : "Re-analyse"}
        </Button>
      </div>

      {/* AI insight card */}
      <section className="clay relative overflow-hidden rounded-3xl border-0 p-6 md:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-gradient-aurora opacity-25 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 -bottom-16 h-56 w-56 rounded-full bg-gradient-primary opacity-15 blur-3xl" />
        <div className="relative flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-primary text-white shadow-clay-sm">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">AI study coach</div>
            {loadingAI && !insight ? (
              <div className="mt-2 space-y-2">
                <div className="h-5 w-2/3 animate-pulse rounded-md bg-muted" />
                <div className="h-4 w-full animate-pulse rounded-md bg-muted" />
                <div className="h-4 w-4/5 animate-pulse rounded-md bg-muted" />
              </div>
            ) : aiError ? (
              <div className="mt-2 flex items-start gap-2 rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4" />
                <div>
                  <div className="font-semibold">Couldn't reach the AI right now.</div>
                  <div className="text-xs opacity-80">{aiError}</div>
                </div>
              </div>
            ) : insight ? (
              <>
                <h3 className="mt-1 font-display text-xl font-bold md:text-2xl">
                  {insight.headline ?? "Here's how you're doing"}
                </h3>
                {insight.summary && (
                  <p className="mt-2 max-w-3xl text-sm text-foreground/80 md:text-base">{insight.summary}</p>
                )}
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {insight.bullets && insight.bullets.length > 0 && (
                    <div className="rounded-2xl bg-background/60 p-4 shadow-clay-sm">
                      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        <TrendingUp className="h-3.5 w-3.5 text-primary" /> Patterns we spotted
                      </div>
                      <ul className="space-y-2 text-sm">
                        {insight.bullets.map((b, i) => (
                          <li key={i} className="flex gap-2"><span className="text-primary">•</span><span>{b}</span></li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {insight.next_actions && insight.next_actions.length > 0 && (
                    <div className="rounded-2xl bg-background/60 p-4 shadow-clay-sm">
                      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        <Lightbulb className="h-3.5 w-3.5 text-primary" /> Do this next
                      </div>
                      <ul className="space-y-2 text-sm">
                        {insight.next_actions.map((b, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gradient-primary text-[10px] font-bold text-white">{i + 1}</span>
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      </section>

      {/* Stat grid */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPI icon={Trophy} label={`${me?.name?.split(" ")[0] ?? "You"} completed`} value={stats.me.done} sub={`${stats.me.pct}% of curriculum`} grad="bg-gradient-abhay" />
        <KPI icon={Target} label="Done this week" value={stats.me.week} sub={`${stats.me.today} today`} grad="bg-gradient-primary" />
        <KPI icon={Flame} label="Your streak" value={`${stats.me.streak}d`} sub={stats.me.streak >= 3 ? "On fire 🔥" : "Build it back"} grad="bg-gradient-aurora" />
        <KPI icon={Trophy} label={`${partner?.name?.split(" ")[0] ?? "Partner"} completed`} value={stats.partner.done} sub={`${stats.partner.pct}% · ${stats.partner.streak}d streak`} grad="bg-gradient-aishwarya" />
      </section>

      {/* Head to head */}
      <section className="grid gap-4 lg:grid-cols-[1fr_1.6fr]">
        <div className="clay rounded-3xl border-0 p-6">
          <h3 className="mb-1 font-display text-lg font-semibold">Head to head</h3>
          <p className="mb-4 text-xs text-muted-foreground">Percent of the full curriculum completed.</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart innerRadius="40%" outerRadius="100%" data={radial} startAngle={90} endAngle={-270}>
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar dataKey="value" cornerRadius={20} background={{ fill: "var(--muted)" }} />
                <Legend iconType="circle" />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="clay rounded-3xl border-0 p-6">
          <h3 className="mb-1 font-display text-lg font-semibold">Last 14 days · daily activity</h3>
          <p className="mb-4 text-xs text-muted-foreground">Topics each of you ticked off, day by day.</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weekly}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} />
                <Legend />
                {profiles.map((p, i) => (
                  <Line key={p.id} type="monotone" dataKey={p.name.split(" ")[0]}
                    stroke={i === 0 ? "var(--abhay, #6366f1)" : "var(--aishwarya, #ec4899)"}
                    strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Subject bars */}
      <section className="clay rounded-3xl border-0 p-6">
        <h3 className="mb-1 font-display text-lg font-semibold">Subject-wise completion</h3>
        <p className="mb-4 text-xs text-muted-foreground">Stack of topics each of you has cleared per subject.</p>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={bySubject}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} angle={-30} textAnchor="end" height={80} interval={0} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} />
              <Legend />
              {profiles.map((p, i) => (
                <Bar key={p.id} dataKey={p.name.split(" ")[0]}
                  fill={i === 0 ? "var(--abhay, #6366f1)" : "var(--aishwarya, #ec4899)"}
                  radius={[8, 8, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <RankList title="🏆 Most completed" items={rankings.top} accent="bg-gradient-abhay" />
        <RankList title="💔 Needs love" items={rankings.bottom} accent="bg-gradient-aishwarya" />
      </div>
    </div>
  );
}

function KPI({ icon: Icon, label, value, sub, grad }: { icon: typeof Sparkles; label: string; value: string | number; sub?: string; grad: string }) {
  return (
    <div className="clay relative overflow-hidden rounded-3xl border-0 p-5">
      <div className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full ${grad} opacity-25 blur-2xl`} />
      <div className="relative flex items-start justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="mt-1 font-display text-3xl font-bold">{value}</div>
          {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
        </div>
        <div className={`grid h-10 w-10 place-items-center rounded-2xl ${grad} text-white shadow-clay-sm`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function RankList({ title, items, accent }: { title: string; items: { name: string; pct: number; total: number }[]; accent: string }) {
  return (
    <div className="clay rounded-3xl border-0 p-6">
      <h3 className="mb-4 font-display text-lg font-semibold">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No data yet — add some topics.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((r) => (
            <li key={r.name} className="flex items-center justify-between gap-3">
              <span className="truncate text-sm font-medium">{r.name}</span>
              <div className="flex items-center gap-2">
                <div className="h-2 w-32 overflow-hidden rounded-full bg-muted">
                  <div className={`h-full ${accent} transition-all`} style={{ width: `${r.pct}%` }} />
                </div>
                <span className="w-10 text-right text-xs font-semibold tabular-nums">{r.pct}%</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
