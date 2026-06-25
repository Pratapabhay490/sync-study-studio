import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useData } from "@/lib/data-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/user-avatar";
import { ProgressRing } from "@/components/progress-ring";
import { Check, ListChecks, Plus, Trash2, CalendarDays } from "lucide-react";
import { celebrate } from "@/lib/celebrate";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/daily-board")({
  component: DailyBoardPage,
});

interface DailyTask {
  id: string;
  user_id: string;
  title: string;
  done: boolean;
  task_date: string;
  position: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function DailyBoardPage() {
  const { user } = useAuth();
  const { profiles } = useData();
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState<string>(todayISO());

  const me = profiles.find((p) => p.id === user?.id);
  const partners = profiles.filter((p) => p.id !== user?.id);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("daily_tasks" as never)
      .select("*")
      .eq("task_date", date)
      .order("created_at", { ascending: true });
    setTasks((data as DailyTask[] | null) ?? []);
    setLoading(false);
  }, [date]);

  useEffect(() => {
    if (!user) return;
    load();
    const channel = supabase
      .channel(`daily-tasks-${date}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "daily_tasks" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, date, load]);

  const myTasks = useMemo(
    () => tasks.filter((t) => t.user_id === user?.id),
    [tasks, user?.id],
  );

  return (
    <div className="space-y-6">
      <header className="clay flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-primary text-white shadow-clay-sm">
            <ListChecks className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold md:text-3xl">Daily Task Board</h1>
            <p className="text-sm text-muted-foreground">
              Plan today, finish together. Your partner sees it live.
            </p>
          </div>
        </div>
        <div className="clay-pressed flex items-center gap-3 px-4 py-2.5">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value || todayISO())}
            className="bg-transparent text-sm font-semibold outline-none"
          />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <TaskColumn
          ownerId={user!.id}
          profile={me}
          isMe
          date={date}
          tasks={myTasks}
          loading={loading}
        />
        {partners.length === 0 ? (
          <div className="clay grid place-items-center p-10 text-center text-sm text-muted-foreground">
            Add a study partner to see their daily board here.
          </div>
        ) : (
          partners.map((p) => (
            <TaskColumn
              key={p.id}
              ownerId={p.id}
              profile={p}
              isMe={false}
              date={date}
              tasks={tasks.filter((t) => t.user_id === p.id)}
              loading={loading}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface ColumnProps {
  ownerId: string;
  profile: { id: string; name: string; email: string | null; avatar_url: string | null } | undefined | null;
  isMe: boolean;
  date: string;
  tasks: DailyTask[];
  loading: boolean;
}

function TaskColumn({ ownerId, profile, isMe, date, tasks, loading }: ColumnProps) {
  const [title, setTitle] = useState("");
  const [adding, setAdding] = useState(false);

  const done = tasks.filter((t) => t.done).length;
  const total = tasks.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  async function add() {
    const text = title.trim();
    if (!text || adding) return;
    setAdding(true);
    const { error } = await supabase
      .from("daily_tasks" as never)
      .insert({ user_id: ownerId, title: text, task_date: date });
    setAdding(false);
    if (!error) setTitle("");
  }

  async function toggle(t: DailyTask) {
    const next = !t.done;
    await supabase
      .from("daily_tasks" as never)
      .update({ done: next, completed_at: next ? new Date().toISOString() : null })
      .eq("id", t.id);
    if (next) celebrate();
  }

  async function remove(t: DailyTask) {
    await supabase.from("daily_tasks" as never).delete().eq("id", t.id);
  }

  return (
    <section className="clay flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <UserAvatar profile={profile} size={44} />
          <div>
            <div className="font-display text-base font-bold leading-tight">
              {isMe ? "Your Board" : `${profile?.name ?? "Partner"}'s Board`}
            </div>
            <div className="text-xs text-muted-foreground">
              {done} of {total} done today
            </div>
          </div>
        </div>
        <ProgressRing value={pct} size={56} stroke={6} />
      </div>

      {isMe && (
        <div className="flex gap-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
            }}
            placeholder="Add a task for today…"
          />
          <Button onClick={add} disabled={!title.trim() || adding} className="shrink-0">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {loading && tasks.length === 0 ? (
          <li className="clay-pressed p-4 text-center text-sm text-muted-foreground">Loading…</li>
        ) : tasks.length === 0 ? (
          <li className="clay-pressed p-6 text-center text-sm text-muted-foreground">
            {isMe ? "No tasks yet. Add your first one ↑" : "Nothing planned yet."}
          </li>
        ) : (
          tasks.map((t) => (
            <li
              key={t.id}
              className={cn(
                "clay-pressed group flex items-center gap-3 p-3 transition-all",
                t.done && "opacity-70",
              )}
            >
              <button
                onClick={() => isMe && toggle(t)}
                disabled={!isMe}
                aria-label={t.done ? "Mark incomplete" : "Mark complete"}
                className={cn(
                  "grid h-9 w-9 shrink-0 place-items-center rounded-xl shadow-clay-sm transition-all",
                  t.done
                    ? "bg-gradient-primary text-white"
                    : "bg-card text-muted-foreground hover:-translate-y-0.5",
                  !isMe && "cursor-default opacity-80",
                )}
              >
                <Check className={cn("h-4 w-4", !t.done && "opacity-0")} />
              </button>
              <span
                className={cn(
                  "min-w-0 flex-1 text-sm font-medium break-words",
                  t.done && "line-through text-muted-foreground",
                )}
              >
                {t.title}
              </span>
              {isMe && (
                <button
                  onClick={() => remove(t)}
                  aria-label="Delete task"
                  className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground opacity-0 transition-all hover:text-destructive group-hover:opacity-100"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
