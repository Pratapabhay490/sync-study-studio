import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, ChevronRight, ListChecks, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProgressRing } from "@/components/progress-ring";
import { UserAvatar } from "@/components/user-avatar";
import { celebrate } from "@/lib/celebrate";
import { cn } from "@/lib/utils";
import { supabase as supabaseTyped } from "@/integrations/supabase/client";

const supabase = supabaseTyped as unknown as {
  from: (table: string) => any;
  channel: (name: string) => any;
  removeChannel: (channel: any) => void;
};

export interface DailyTask {
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

type TaskProfile = {
  id: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
};

export function todayISO() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function DailyTaskBoard({
  currentUserId,
  profiles,
  date,
  showFullBoardLink = false,
}: {
  currentUserId: string;
  profiles: TaskProfile[];
  date: string;
  showFullBoardLink?: boolean;
}) {
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("daily_tasks")
      .select("id,user_id,title,done,task_date,position,completed_at,created_at,updated_at")
      .eq("task_date", date)
      .order("created_at", { ascending: true });
    if (error) toast.error("Tasks could not be loaded");
    setTasks((data as DailyTask[] | null) ?? []);
    setLoading(false);
  }, [date]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    load();
    const channel = supabase
      .channel(`daily-board:${date}:${currentUserId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "daily_tasks", filter: `task_date=eq.${date}` },
        (payload: { eventType: string; new: DailyTask; old: { id?: string } }) => {
          if (!active) return;
          if (payload.eventType === "DELETE") {
            setTasks((rows) => rows.filter((task) => task.id !== payload.old.id));
            return;
          }
          const next = payload.new;
          if (!next?.id || next.task_date !== date) return;
          setTasks((rows) => {
            const exists = rows.some((task) => task.id === next.id);
            return exists
              ? rows.map((task) => (task.id === next.id ? next : task))
              : [...rows, next].sort((a, b) => a.created_at.localeCompare(b.created_at));
          });
        },
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [currentUserId, date, load]);

  const orderedProfiles = useMemo(() => {
    const mine = profiles.find((profile) => profile.id === currentUserId);
    const partners = profiles.filter((profile) => profile.id !== currentUserId);
    return [...(mine ? [mine] : []), ...partners];
  }, [currentUserId, profiles]);

  return (
    <section className="clay min-w-0 overflow-hidden p-3.5 sm:p-5 md:p-6">
      <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:mb-5 sm:gap-3">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-clay-sm sm:h-11 sm:w-11 sm:rounded-2xl">
            <ListChecks className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate font-display text-base font-bold sm:text-lg">Today’s task board</h2>
            <p className="hidden text-xs text-muted-foreground min-[390px]:block">Plan it, tick it, cheer each other on.</p>
          </div>
        </div>
        {showFullBoardLink && (
          <Link to="/daily-board" aria-label="Open full task board" className="inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold text-primary sm:gap-1">
            <span className="hidden min-[390px]:inline">Open full board</span><span className="min-[390px]:hidden">Open</span> <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {orderedProfiles.map((profile) => (
          <TaskColumn
            key={profile.id}
            owner={profile}
            currentUserId={currentUserId}
            date={date}
            tasks={tasks.filter((task) => task.user_id === profile.id)}
            loading={loading}
            onTasksChange={setTasks}
          />
        ))}
        {orderedProfiles.length < 2 && (
          <div className="clay-pressed grid min-h-40 place-items-center p-6 text-center text-sm text-muted-foreground">
            Add a study partner to see both task lists here.
          </div>
        )}
      </div>
    </section>
  );
}

function TaskColumn({
  owner,
  currentUserId,
  date,
  tasks,
  loading,
  onTasksChange,
}: {
  owner: TaskProfile;
  currentUserId: string;
  date: string;
  tasks: DailyTask[];
  loading: boolean;
  onTasksChange: React.Dispatch<React.SetStateAction<DailyTask[]>>;
}) {
  const [title, setTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const isMe = owner.id === currentUserId;
  const done = tasks.filter((task) => task.done).length;
  const percent = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

  async function addTask() {
    const text = title.trim();
    if (!text || adding) return;
    setAdding(true);
    const { data, error } = await supabase
      .from("daily_tasks")
      .insert({ user_id: currentUserId, title: text, task_date: date })
      .select("id,user_id,title,done,task_date,position,completed_at,created_at,updated_at")
      .single();
    setAdding(false);
    if (error) {
      toast.error("Task could not be added");
      return;
    }
    setTitle("");
    if (data) onTasksChange((rows) => [...rows.filter((task) => task.id !== data.id), data]);
  }

  async function toggleTask(task: DailyTask) {
    const nextDone = !task.done;
    const completedAt = nextDone ? new Date().toISOString() : null;
    onTasksChange((rows) =>
      rows.map((row) => row.id === task.id ? { ...row, done: nextDone, completed_at: completedAt } : row),
    );
    const { error } = await supabase
      .from("daily_tasks")
      .update({ done: nextDone, completed_at: completedAt })
      .eq("id", task.id);
    if (error) {
      onTasksChange((rows) => rows.map((row) => row.id === task.id ? task : row));
      toast.error("Task could not be updated");
      return;
    }
    if (nextDone) celebrate();
  }

  async function deleteTask(task: DailyTask) {
    onTasksChange((rows) => rows.filter((row) => row.id !== task.id));
    const { error } = await supabase.from("daily_tasks").delete().eq("id", task.id);
    if (error) {
      onTasksChange((rows) => [...rows, task].sort((a, b) => a.created_at.localeCompare(b.created_at)));
      toast.error("Task could not be deleted");
    }
  }

  return (
    <div className="min-w-0 rounded-2xl border border-border bg-background/40 p-3 sm:p-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <UserAvatar profile={owner as never} size={42} />
          <div className="min-w-0">
            <div className="truncate text-sm font-bold">{isMe ? "Your list" : `${owner.name.split(" ")[0]}’s list`}</div>
            <div className="text-xs text-muted-foreground">{done} of {tasks.length} complete</div>
          </div>
        </div>
        <ProgressRing value={percent} size={50} stroke={6}>
          <span className="text-[11px] font-bold tabular-nums">{percent}%</span>
        </ProgressRing>
      </div>

      {isMe && (
        <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && addTask()}
            placeholder="What will you finish today?"
            aria-label="New task"
          />
          <Button onClick={addTask} disabled={!title.trim() || adding} size="icon" aria-label="Add task" className="shrink-0">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}

      <ul className="mt-4 space-y-2">
        {loading && tasks.length === 0 ? (
          <li className="h-12 animate-pulse rounded-xl bg-muted/60" />
        ) : tasks.length === 0 ? (
          <li className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            {isMe ? "Your next small win starts here." : "Nothing planned yet."}
          </li>
        ) : tasks.map((task) => (
          <li key={task.id} className={cn("group grid min-h-12 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-border bg-card/70 p-2 sm:gap-3 sm:p-2.5", task.done && "bg-success/10")}>
            <Button
              type="button"
              size="icon"
              variant={task.done ? "default" : "outline"}
              disabled={!isMe}
              onClick={() => toggleTask(task)}
              aria-label={task.done ? "Mark incomplete" : "Mark complete"}
              className={cn("h-8 w-8 shrink-0 rounded-xl", task.done && "bg-success text-success-foreground")}
            >
              <Check className={cn("h-4 w-4", !task.done && "opacity-25")} />
            </Button>
            <span className={cn("min-w-0 flex-1 break-words text-sm font-medium", task.done && "text-muted-foreground line-through")}>
              {task.title}
            </span>
            {isMe && (
              <Button type="button" size="icon" variant="ghost" onClick={() => deleteTask(task)} aria-label="Delete task" className="h-8 w-8 shrink-0 text-muted-foreground md:opacity-0 md:group-hover:opacity-100">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}