import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useData } from "@/lib/data-context";
import { UserAvatar } from "@/components/user-avatar";
import { formatDistanceToNow, parseISO, format } from "date-fns";
import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => ({ meta: [{ title: "Activity — Let's be in sync" }] }),
  component: ActivityPage,
});

function ActivityPage() {
  const { progress, topics, subjects, profiles } = useData();

  const events = useMemo(
    () =>
      progress
        .filter((p) => p.completed && p.completed_at)
        .sort((a, b) => (b.completed_at! > a.completed_at! ? 1 : -1)),
    [progress],
  );

  const grouped = useMemo(() => {
    const map: Record<string, typeof events> = {};
    for (const e of events) {
      const key = format(parseISO(e.completed_at!), "EEEE, MMM d");
      (map[key] ||= []).push(e);
    }
    return map;
  }, [events]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">Activity</h1>
        <p className="mt-1 text-sm text-muted-foreground">A timeline of every topic you've conquered together.</p>
      </div>

      {events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">
          No completions yet — go finish your first topic!
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([day, list]) => (
            <div key={day}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{day}</h3>
              <ul className="space-y-2">
                {list.map((e) => {
                  const topic = topics.find((t) => t.id === e.topic_id);
                  const subject = subjects.find((s) => s.id === topic?.subject_id);
                  const who = profiles.find((p) => p.id === e.user_id);
                  return (
                    <li key={e.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-card">
                      <UserAvatar profile={who} size={36} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm">
                          <span className="font-semibold">{who?.name?.split(" ")[0] ?? "Someone"}</span>
                          <span className="text-muted-foreground"> completed </span>
                          <span className="font-medium">{topic?.topic_name ?? "a topic"}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {subject?.name} · {formatDistanceToNow(parseISO(e.completed_at!), { addSuffix: true })}
                        </div>
                      </div>
                      <CheckCircle2 className="h-5 w-5 text-success" />
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
