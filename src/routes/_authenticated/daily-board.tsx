import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useData } from "@/lib/data-context";
import { DailyTaskBoard, todayISO } from "@/components/daily-task-board";
import { CalendarDays } from "lucide-react";

export const Route = createFileRoute("/_authenticated/daily-board")({
  head: () => ({
    meta: [
      { title: "Daily Task Board — SyncStudy" },
      { name: "description", content: "Plan today’s study tasks and follow your partner’s progress live." },
      { property: "og:title", content: "Daily Task Board — SyncStudy" },
      { property: "og:description", content: "Plan today’s study tasks and follow your partner’s progress live." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DailyBoardPage,
});

function DailyBoardPage() {
  const { user } = useAuth();
  const { profiles } = useData();
  const [date, setDate] = useState<string>(todayISO());

  if (!user) return null;

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

      <DailyTaskBoard currentUserId={user.id} profiles={profiles} date={date} />
    </div>
  );
}
