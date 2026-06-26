import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart3, Trophy, Target, Clock, Flame, BookOpen, RefreshCw,
  TrendingUp, Brain, ChevronRight, Loader2, CheckCircle2, XCircle,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, RadialBarChart, RadialBar, PolarAngleAxis,
} from "recharts";
import { useAuth } from "@/lib/auth-context";
import { useData } from "@/lib/data-context";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import { sb } from "@/lib/practice";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/practice-stats")({
  component: PracticeStatsPage,
});

type AnswerRow = {
  id: string;
  user_id: string;
  question_id: string;
  is_correct: boolean;
  ms_taken: number | null;
  answered_at: string;
  session_id: string;
};
type PlayerRow = {
  session_id: string; user_id: string; score: number;
  correct_count: number; attempted_count: number; status: string;
  finished_at: string | null; joined_at: string;
};
type SessionRow = {
  id: string; subject: string | null; topic: string | null;
  difficulty: string | null; mode: string; created_at: string;
};
type ReviewRow = {
  id: string; question_id: string; wrong_count: number;
  last_wrong_at: string; next_review_at: string; resolved: boolean;
  question?: { stem: string; subject: string | null; topic: string | null };
};

function PracticeStatsPage() {
  const { user } = useAuth();
  const { profiles } = useData();
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<AnswerRow[]>([]);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [sessions, setSessions] = useState<Record<string, SessionRow>>({});
  const [reviewDue, setReviewDue] = useState<ReviewRow[]>([]);
  const partner = useMemo(() => profiles.find((p) => p.id !== user?.id), [profiles, user]);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const ids = [user.id, partner?.id].filter(Boolean) as string[];
    const [ansRes, playersRes, sessionsRes, reviewRes] = await Promise.all([
      sb.from("quiz_answers").select("*").in("user_id", ids).order("answered_at", { ascending: false }).limit(2000),
      sb.from("quiz_session_players").select("*").in("user_id", ids).limit(2000),
      sb.from("quiz_sessions").select("*").order("created_at", { ascending: false }).limit(500),
      sb.from("quiz_wrong_bank")
        .select("*, question:quiz_questions(stem,subject,topic)")
        .eq("user_id", user.id)
        .eq("resolved", false)
        .order("next_review_at", { ascending: true })
        .limit(50),
    ]);
    setAnswers((ansRes.data as AnswerRow[]) ?? []);
    setPlayers((playersRes.data as PlayerRow[]) ?? []);
    const map: Record<string, SessionRow> = {};
    ((sessionsRes.data as SessionRow[]) ?? []).forEach((s) => { map[s.id] = s; });
    setSessions(map);
    setReviewDue((reviewRes.data as ReviewRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [user?.id, partner?.id]);

  const myAns = answers.filter((a) => a.user_id === user?.id);
  const partnerAns = partner ? answers.filter((a) => a.user_id === partner.id) : [];

  const stat = (rows: AnswerRow[]) => {
    const total = rows.length;
    const correct = rows.filter((r) => r.is_correct).length;
    const avgMs = total ? Math.round(rows.reduce((s, r) => s + (r.ms_taken ?? 0), 0) / total) : 0;
    return { total, correct, accuracy: total ? Math.round((correct / total) * 100) : 0, avgMs };
  };
  const me = stat(myAns);
  const pa = stat(partnerAns);

  // Sessions per day (last 14d) — me only
  const dayBuckets = useMemo(() => {
    const days: { date: string; correct: number; wrong: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      days.push({ date: d.toISOString().slice(5, 10), correct: 0, wrong: 0 });
    }
    const idx = (iso: string) => {
      const k = iso.slice(5, 10);
      return days.findIndex((d) => d.date === k);
    };
    myAns.forEach((a) => {
      const i = idx(a.answered_at);
      if (i >= 0) (a.is_correct ? (days[i].correct++) : (days[i].wrong++));
    });
    return days;
  }, [myAns]);

  // Accuracy by subject (using session info)
  const bySubject = useMemo(() => {
    const m = new Map<string, { total: number; correct: number }>();
    myAns.forEach((a) => {
      const s = sessions[a.session_id]?.subject ?? "Mixed";
      const cur = m.get(s) ?? { total: 0, correct: 0 };
      cur.total++; if (a.is_correct) cur.correct++;
      m.set(s, cur);
    });
    return Array.from(m.entries())
      .map(([subject, v]) => ({ subject, accuracy: Math.round((v.correct / v.total) * 100), total: v.total }))
      .sort((a, b) => b.total - a.total).slice(0, 8);
  }, [myAns, sessions]);

  // Leaderboard (cumulative)
  const leaderboard = useMemo(() => {
    const acc: Record<string, { score: number; correct: number; attempted: number; sessions: number }> = {};
    players.forEach((p) => {
      const a = acc[p.user_id] ?? { score: 0, correct: 0, attempted: 0, sessions: 0 };
      a.score += p.score ?? 0;
      a.correct += p.correct_count ?? 0;
      a.attempted += p.attempted_count ?? 0;
      a.sessions += 1;
      acc[p.user_id] = a;
    });
    return Object.entries(acc).map(([uid, v]) => {
      const prof = profiles.find((p) => p.id === uid);
      return {
        id: uid,
        name: prof?.name ?? prof?.email ?? "Player",
        avatar: prof?.avatar_url,
        ...v,
        accuracy: v.attempted ? Math.round((v.correct / v.attempted) * 100) : 0,
      };
    }).sort((a, b) => b.score - a.score);
  }, [players, profiles]);

  // Streak — consecutive days with at least one answer
  const streak = useMemo(() => {
    const set = new Set(myAns.map((a) => a.answered_at.slice(0, 10)));
    let s = 0; const d = new Date();
    for (let i = 0; i < 60; i++) {
      const k = d.toISOString().slice(0, 10);
      if (set.has(k)) { s++; d.setDate(d.getDate() - 1); } else break;
    }
    return s;
  }, [myAns]);

  const dueNow = reviewDue.filter((r) => new Date(r.next_review_at) <= new Date());

  if (loading) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <div className="clay flex items-center gap-3 px-6 py-4">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Crunching your numbers…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <BarChart3 className="h-4 w-4" /> Practice Analytics
          </div>
          <h1 className="font-display text-3xl font-bold md:text-4xl">Quiz performance</h1>
          <p className="text-sm text-muted-foreground">Every MCQ you've answered, across all sessions.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" /> Refresh</Button>
          <Link to="/practice"><Button><Brain className="mr-2 h-4 w-4" /> New session</Button></Link>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiTile icon={<Target className="h-5 w-5" />} label="Accuracy" value={`${me.accuracy}%`}
          hint={`${me.correct}/${me.total} correct`} accent="from-emerald-500/30 to-emerald-500/10" />
        <KpiTile icon={<Trophy className="h-5 w-5" />} label="Total answered" value={`${me.total}`}
          hint={`${Object.keys(sessions).length ? Math.min(Object.keys(sessions).length, players.filter(p => p.user_id === user?.id).length) : 0} sessions`}
          accent="from-amber-500/30 to-amber-500/10" />
        <KpiTile icon={<Clock className="h-5 w-5" />} label="Avg time" value={`${(me.avgMs / 1000).toFixed(1)}s`}
          hint="per question" accent="from-sky-500/30 to-sky-500/10" />
        <KpiTile icon={<Flame className="h-5 w-5" />} label="Day streak" value={`${streak}`}
          hint={streak ? "Keep it going" : "Start today"} accent="from-rose-500/30 to-rose-500/10" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Activity chart */}
        <div className="clay p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-semibold">Last 14 days</h2>
              <p className="text-xs text-muted-foreground">Questions answered per day</p>
            </div>
            <Badge variant="secondary"><TrendingUp className="mr-1 h-3 w-3" /> {myAns.length} total</Badge>
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={dayBuckets}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                <Bar dataKey="correct" stackId="a" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                <Bar dataKey="wrong" stackId="a" fill="hsl(var(--muted-foreground) / 0.4)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Accuracy ring */}
        <div className="clay flex flex-col items-center justify-center p-5">
          <h2 className="mb-3 font-display text-lg font-semibold">Accuracy</h2>
          <div className="h-48 w-48">
            <ResponsiveContainer>
              <RadialBarChart innerRadius="70%" outerRadius="100%" data={[{ name: "acc", value: me.accuracy, fill: "hsl(var(--primary))" }]} startAngle={90} endAngle={-270}>
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar dataKey="value" cornerRadius={20} background={{ fill: "hsl(var(--muted) / 0.5)" }} />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
          <div className="-mt-32 text-center">
            <div className="font-display text-4xl font-bold">{me.accuracy}%</div>
            <div className="text-xs text-muted-foreground">{me.correct} correct</div>
          </div>
          {partner && (
            <div className="mt-24 flex items-center gap-2 rounded-2xl bg-muted/40 px-3 py-2 text-xs">
              <UserAvatar profile={partner} size={28} />
              <span className="text-muted-foreground">{partner.name?.split(" ")[0] ?? "Partner"} at</span>
              <span className="font-semibold">{pa.accuracy}%</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Subject accuracy */}
        <div className="clay p-5">
          <h2 className="mb-3 font-display text-lg font-semibold">Accuracy by subject</h2>
          {bySubject.length === 0 ? (
            <Empty label="Take a quiz to see breakdowns" />
          ) : (
            <div className="space-y-3">
              {bySubject.map((s) => (
                <div key={s.subject}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium">{s.subject}</span>
                    <span className="text-muted-foreground">{s.accuracy}% · {s.total}q</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className={cn("h-full rounded-full transition-all",
                      s.accuracy >= 75 ? "bg-emerald-500" : s.accuracy >= 50 ? "bg-amber-500" : "bg-rose-500")}
                      style={{ width: `${s.accuracy}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Leaderboard */}
        <div className="clay p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Leaderboard</h2>
            <Badge variant="secondary"><Trophy className="mr-1 h-3 w-3" /> All-time</Badge>
          </div>
          {leaderboard.length === 0 ? (
            <Empty label="No sessions yet" />
          ) : (
            <ol className="space-y-2">
              {leaderboard.map((row, i) => (
                <li key={row.id}
                  className={cn("flex items-center gap-3 rounded-2xl px-3 py-2",
                    i === 0 ? "bg-amber-500/15" : "bg-muted/40")}>
                  <div className={cn("grid h-8 w-8 place-items-center rounded-full font-display text-sm font-bold",
                    i === 0 ? "bg-amber-500 text-white" : "bg-card text-muted-foreground")}>
                    {i + 1}
                  </div>
                  <UserAvatar profile={{ id: row.id, name: row.name, avatar_url: row.avatar ?? null } as any} size={28} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{row.name}</div>
                    <div className="text-xs text-muted-foreground">{row.sessions} sessions · {row.accuracy}% accuracy</div>
                  </div>
                  <div className="font-display text-lg font-bold">{row.score}</div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {/* Review bank */}
      <div className="clay p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-semibold flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" /> Review bank
            </h2>
            <p className="text-xs text-muted-foreground">Questions you got wrong, scheduled for spaced repetition.</p>
          </div>
          <Badge variant={dueNow.length ? "default" : "secondary"}>
            {dueNow.length} due now · {reviewDue.length} total
          </Badge>
        </div>
        {reviewDue.length === 0 ? (
          <Empty label="No mistakes to review — nice work!" />
        ) : (
          <ul className="divide-y divide-border/60">
            {reviewDue.slice(0, 10).map((r) => {
              const due = new Date(r.next_review_at) <= new Date();
              return (
                <li key={r.id} className="flex items-start gap-3 py-3">
                  <div className={cn("mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-xl",
                    due ? "bg-rose-500/20 text-rose-600" : "bg-muted text-muted-foreground")}>
                    {due ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 text-sm font-medium">{r.question?.stem ?? "Question"}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {r.question?.subject && <span>{r.question.subject}</span>}
                      <span>·</span>
                      <span>Missed {r.wrong_count}×</span>
                      <span>·</span>
                      <span>{due ? "Due now" : `Next ${new Date(r.next_review_at).toLocaleDateString()}`}</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function KpiTile({ icon, label, value, hint, accent }: {
  icon: React.ReactNode; label: string; value: string; hint?: string; accent?: string;
}) {
  return (
    <div className="clay relative overflow-hidden p-4">
      <div className={cn("absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br opacity-60", accent)} />
      <div className="relative">
        <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-card text-primary shadow-clay-sm">
          {icon}
        </div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="font-display text-2xl font-bold leading-tight">{value}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="grid place-items-center py-10 text-center">
      <div className="text-sm text-muted-foreground">{label}</div>
      <Link to="/practice" className="mt-2">
        <Button variant="outline" size={28}>Start a quiz <ChevronRight className="ml-1 h-3 w-3" /></Button>
      </Link>
    </div>
  );
}
