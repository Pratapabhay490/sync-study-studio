import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useData } from "@/lib/data-context";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, LineChart, Line, CartesianGrid, Legend } from "recharts";
import { parseISO, startOfDay, subDays, format } from "date-fns";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Let's be in sync" }] }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { subjects, topics, progress, profiles } = useData();

  const bySubject = useMemo(
    () =>
      subjects.map((s) => {
        const sTopics = topics.filter((t) => t.subject_id === s.id);
        const row: Record<string, string | number> = { name: s.name, total: sTopics.length };
        profiles.forEach((p) => {
          row[p.name.split(" ")[0]] = progress.filter(
            (pr) => pr.user_id === p.id && pr.completed && sTopics.some((t) => t.id === pr.topic_id),
          ).length;
        });
        return row;
      }),
    [subjects, topics, progress, profiles],
  );

  const weekly = useMemo(() => {
    const days = Array.from({ length: 14 }).map((_, i) => startOfDay(subDays(new Date(), 13 - i)));
    return days.map((d) => {
      const row: Record<string, string | number> = { day: format(d, "MMM d") };
      profiles.forEach((p) => {
        row[p.name.split(" ")[0]] = progress.filter(
          (pr) =>
            pr.user_id === p.id &&
            pr.completed &&
            pr.completed_at &&
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
      const pct = sTopics.length ? Math.round((done / sTopics.length) * 100) : 0;
      return { name: s.name, pct, total: sTopics.length };
    });
    return {
      top: [...arr].sort((a, b) => b.pct - a.pct).slice(0, 5),
      bottom: [...arr].sort((a, b) => a.pct - b.pct).slice(0, 5),
    };
  }, [subjects, topics, progress]);

  const colors = ["var(--abhay)", "var(--aishwarya)"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">Insights across all subjects and study partners.</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <h3 className="mb-4 font-display text-lg font-semibold">Subject-wise completion</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={bySubject}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} angle={-30} textAnchor="end" height={80} interval={0} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} />
              <Legend />
              {profiles.map((p, i) => (
                <Bar key={p.id} dataKey={p.name.split(" ")[0]} fill={colors[i % colors.length]} radius={[6, 6, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <h3 className="mb-4 font-display text-lg font-semibold">Last 14 days · daily activity</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weekly}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} />
              <Legend />
              {profiles.map((p, i) => (
                <Line key={p.id} type="monotone" dataKey={p.name.split(" ")[0]} stroke={colors[i % colors.length]} strokeWidth={3} dot={{ r: 3 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <RankList title="Most completed" items={rankings.top} accent="bg-gradient-abhay" />
        <RankList title="Needs love" items={rankings.bottom} accent="bg-gradient-aishwarya" />
      </div>
    </div>
  );
}

function RankList({ title, items, accent }: { title: string; items: { name: string; pct: number; total: number }[]; accent: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
      <h3 className="mb-4 font-display text-lg font-semibold">{title}</h3>
      <ul className="space-y-3">
        {items.map((r) => (
          <li key={r.name} className="flex items-center justify-between gap-3">
            <span className="truncate text-sm font-medium">{r.name}</span>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
                <div className={`h-full ${accent}`} style={{ width: `${r.pct}%` }} />
              </div>
              <span className="w-10 text-right text-xs font-semibold">{r.pct}%</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
