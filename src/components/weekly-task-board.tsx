import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarRange, Check, Plus, Repeat2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ProgressRing } from "@/components/progress-ring";
import { UserAvatar } from "@/components/user-avatar";
import { ClayPeek } from "@/components/clay-visuals";
import { BOARD_HINT_CLASS, useBoardSeen } from "@/lib/board-updates";
import { celebrate } from "@/lib/celebrate";
import { cn } from "@/lib/utils";
import { supabase as supabaseTyped } from "@/integrations/supabase/client";

const supabase = supabaseTyped as unknown as {
  from: (table: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => any;
  channel: (name: string) => any;
  removeChannel: (channel: any) => void;
};

type BoardProfile = { id: string; name: string; email: string | null; avatar_url: string | null };

interface WeeklyTask {
  id: string;
  title: string;
  week_start: string;
  carry_count: number;
  created_by: string;
  created_at: string;
}

interface Completion {
  id: string;
  task_id: string;
  user_id: string;
}

function pairKeyFor(a: string, b: string) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function weekLabel(weekStart: string | null) {
  if (!weekStart) return "This week";
  const start = new Date(`${weekStart}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return `${fmt(start)} – ${fmt(end)}`;
}

export function WeeklyTaskBoard({
  currentUserId,
  profiles,
}: {
  currentUserId: string;
  profiles: BoardProfile[];
}) {
  const [week, setWeek] = useState<string | null>(null);
  const [tasks, setTasks] = useState<WeeklyTask[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const weekRef = useRef<string | null>(null);

  const partner = profiles.find((p) => p.id !== currentUserId) ?? null;
  const me = profiles.find((p) => p.id === currentUserId) ?? null;
  const members = useMemo(
    () => [me, partner].filter(Boolean) as BoardProfile[],
    [me, partner],
  );
  const required = partner ? 2 : 1;
  const pairKey = pairKeyFor(currentUserId, partner?.id ?? currentUserId);

  const { hasPartnerUpdate, notifyPartnerChange, seenRefCallback } = useBoardSeen(
    currentUserId,
    "weekly",
  );

  const load = useCallback(async () => {
    const { data: weekStart, error: weekError } = await supabase.rpc("ensure_weekly_tasks");
    if (weekError) {
      toast.error("Weekly board could not be loaded");
      setLoading(false);
      return;
    }
    const ws = weekStart as string;
    weekRef.current = ws;
    setWeek(ws);
    const { data: taskRows } = await supabase
      .from("weekly_tasks")
      .select("id,title,week_start,carry_count,created_by,created_at")
      .eq("week_start", ws)
      .order("created_at", { ascending: true });
    const list = (taskRows as WeeklyTask[] | null) ?? [];
    setTasks(list);
    if (list.length) {
      const { data: compRows } = await supabase
        .from("weekly_task_completions")
        .select("id,task_id,user_id")
        .in("task_id", list.map((t) => t.id));
      setCompletions((compRows as Completion[] | null) ?? []);
    } else {
      setCompletions([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    load();
    const channel = supabase
      .channel(`weekly-board:${pairKey}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "weekly_tasks" },
        (payload: any) => {
          if (!active) return;
          const row = payload.new ?? payload.old;
          if (payload.eventType === "DELETE") {
            setTasks((rows) => rows.filter((t) => t.id !== row?.id));
            return;
          }
          if (!row?.id || row.week_start !== weekRef.current) return;
          setTasks((rows) =>
            rows.some((t) => t.id === row.id)
              ? rows.map((t) => (t.id === row.id ? row : t))
              : [...rows, row].sort((a, b) => a.created_at.localeCompare(b.created_at)),
          );
          if (row.created_by !== currentUserId) notifyPartnerChange();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "weekly_task_completions" },
        (payload: any) => {
          if (!active) return;
          if (payload.eventType === "DELETE") {
            setCompletions((rows) => rows.filter((c) => c.id !== payload.old?.id));
            if (payload.old?.user_id && payload.old.user_id !== currentUserId) notifyPartnerChange();
            return;
          }
          const row = payload.new as Completion;
          if (!row?.id) return;
          setCompletions((rows) => (rows.some((c) => c.id === row.id) ? rows : [...rows, row]));
          if (row.user_id !== currentUserId) notifyPartnerChange();
        },
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [currentUserId, pairKey, load, notifyPartnerChange]);

  const doneBy = useCallback(
    (taskId: string) => completions.filter((c) => c.task_id === taskId).map((c) => c.user_id),
    [completions],
  );

  const fullyDone = tasks.filter((t) => doneBy(t.id).length >= required).length;
  const percent = tasks.length ? Math.round((fullyDone / tasks.length) * 100) : 0;

  async function addTask() {
    const text = title.trim();
    if (!text || adding || !week) return;
    setAdding(true);
    const other = partner?.id ?? currentUserId;
    const [a, b] = currentUserId < other ? [currentUserId, other] : [other, currentUserId];
    const { data, error } = await supabase
      .from("weekly_tasks")
      .insert({
        pair_key: pairKey,
        user_a: a,
        user_b: b,
        week_start: week,
        title: text,
        created_by: currentUserId,
      })
      .select("id,title,week_start,carry_count,created_by,created_at")
      .single();
    setAdding(false);
    if (error) {
      toast.error("Task could not be added");
      return;
    }
    setTitle("");
    if (data) setTasks((rows) => (rows.some((t) => t.id === data.id) ? rows : [...rows, data]));
  }

  async function toggleMine(task: WeeklyTask) {
    const mine = completions.find((c) => c.task_id === task.id && c.user_id === currentUserId);
    if (mine) {
      setCompletions((rows) => rows.filter((c) => c.id !== mine.id));
      const { error } = await supabase.from("weekly_task_completions").delete().eq("id", mine.id);
      if (error) {
        setCompletions((rows) => [...rows, mine]);
        toast.error("Could not update the task");
      }
      return;
    }
    const optimistic: Completion = {
      id: `temp-${task.id}`,
      task_id: task.id,
      user_id: currentUserId,
    };
    setCompletions((rows) => [...rows, optimistic]);
    const { data, error } = await supabase
      .from("weekly_task_completions")
      .insert({ task_id: task.id, user_id: currentUserId })
      .select("id,task_id,user_id")
      .single();
    if (error) {
      setCompletions((rows) => rows.filter((c) => c.id !== optimistic.id));
      toast.error("Could not update the task");
      return;
    }
    setCompletions((rows) => rows.map((c) => (c.id === optimistic.id ? data : c)));
    const total = doneBy(task.id).filter((id) => id !== currentUserId).length + 1;
    if (total >= required) {
      celebrate();
      toast.success("Both of you finished it. Nice teamwork!");
    }
  }

  async function removeTask(task: WeeklyTask) {
    const snapshot = tasks;
    setTasks((rows) => rows.filter((t) => t.id !== task.id));
    const { error } = await supabase.from("weekly_tasks").delete().eq("id", task.id);
    if (error) {
      setTasks(snapshot);
      toast.error("Task could not be removed");
    }
  }

  return (
    <section
      ref={seenRefCallback}
      className="clay relative min-w-0 overflow-hidden p-3.5 sm:p-5 md:p-6"
    >
      <ClayPeek variant="girl" className="-right-6 -top-4 hidden opacity-70 lg:block" />
      <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:mb-5 sm:gap-3">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-clay-sm sm:h-11 sm:w-11 sm:rounded-2xl">
            <CalendarRange className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 truncate font-display text-base font-bold sm:text-lg">
              Weekly goals together
              {hasPartnerUpdate && <span className={BOARD_HINT_CLASS} aria-label="Partner made changes" />}
            </h2>
            <p className="truncate text-xs text-muted-foreground">
              {weekLabel(week)} · Mon to Sun · unfinished tasks roll over
            </p>
          </div>
        </div>
        <ProgressRing value={percent} size={52} stroke={6}>
          <span className="text-[11px] font-bold tabular-nums">{percent}%</span>
        </ProgressRing>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && addTask()}
          placeholder="A goal you'll both finish this week"
          aria-label="New weekly task"
        />
        <Button onClick={addTask} disabled={!title.trim() || adding} size="icon" aria-label="Add weekly task" className="shrink-0">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <ul className="mt-4 space-y-2">
        {loading ? (
          <>
            <li><Skeleton className="h-14 rounded-2xl" /></li>
            <li><Skeleton className="h-14 rounded-2xl" /></li>
            <li><Skeleton className="h-14 rounded-2xl" /></li>
          </>
        ) : tasks.length === 0 ? (
          <li className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            No shared goals yet. Add the first one — it stays until you both tick it.
          </li>
        ) : (
          tasks.map((task) => {
            const done = doneBy(task.id);
            const complete = done.length >= required;
            const mineDone = done.includes(currentUserId);
            return (
              <li
                key={task.id}
                className={cn(
                  "group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-2xl border border-border bg-card/70 p-2 transition-all duration-300 sm:gap-3 sm:p-3",
                  complete && "border-success/40 bg-success/10",
                )}
              >
                <Button
                  type="button"
                  size="icon"
                  variant={mineDone ? "default" : "outline"}
                  onClick={() => toggleMine(task)}
                  aria-label={mineDone ? "Mark as not done for me" : "Mark as done for me"}
                  className={cn(
                    "h-9 w-9 shrink-0 rounded-xl transition-transform active:scale-90",
                    mineDone && "bg-success text-success-foreground",
                  )}
                >
                  <Check className={cn("h-4 w-4", !mineDone && "opacity-25")} />
                </Button>
                <div className="min-w-0">
                  <div
                    className={cn(
                      "break-words text-sm font-medium",
                      complete && "text-muted-foreground line-through",
                    )}
                  >
                    {task.title}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {members.map((member) => {
                      const ticked = done.includes(member.id);
                      return (
                        <span
                          key={member.id}
                          title={`${member.name}${ticked ? " finished" : " pending"}`}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold transition-colors",
                            ticked
                              ? "border-success/40 bg-success/15 text-success"
                              : "border-border text-muted-foreground",
                          )}
                        >
                          <UserAvatar profile={member as never} size={16} />
                          {member.name.split(" ")[0]}
                          {ticked && <Check className="h-3 w-3" />}
                        </span>
                      );
                    })}
                    {task.carry_count > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-500">
                        <Repeat2 className="h-3 w-3" />
                        carried {task.carry_count}w
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => removeTask(task)}
                  aria-label="Remove weekly task"
                  className="h-8 w-8 shrink-0 text-muted-foreground md:opacity-0 md:group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            );
          })
        )}
      </ul>

      {!partner && (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Add a study partner and this board becomes shared.
        </p>
      )}
    </section>
  );
}
