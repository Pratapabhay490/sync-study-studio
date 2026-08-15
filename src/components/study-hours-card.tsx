import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, isSameDay, startOfDay, subDays } from "date-fns";
import { Clock3, Timer } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import clayGirl from "@/assets/clay-girl-doctor.png";

type FocusRow = {
  id: string;
  host_id: string;
  partner_id: string | null;
  duration_min: number;
  started_at: string;
  ends_at: string;
  state: string;
  joined_by_partner: boolean;
  updated_at: string;
};

export type Person = {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
} | null | undefined;

/** Minutes actually spent in a session — capped at the planned end, and cut
 *  short at the moment it was ended early. */
function minutesFor(row: FocusRow, now: number) {
  const start = new Date(row.started_at).getTime();
  const planned = new Date(row.ends_at).getTime();
  const ended = row.state === "ended" || row.state === "done" || row.state === "cancelled";
  const stop = ended
    ? Math.min(planned, new Date(row.updated_at).getTime())
    : Math.min(planned, now);
  return Math.max(0, (stop - start) / 60000);
}

function participants(row: FocusRow) {
  const ids = [row.host_id];
  if (row.partner_id && row.joined_by_partner) ids.push(row.partner_id);
  return ids;
}

export function useStudyHours(userIds: string[]) {
  const [rows, setRows] = useState<FocusRow[]>([]);
  const key = userIds.filter(Boolean).join(",");

  useEffect(() => {
    if (!key) return;
    let live = true;
    const since = subDays(startOfDay(new Date()), 30).toISOString();
    const load = async () => {
      const { data } = await supabase
        .from("focus_sessions")
        .select("*")
        .gte("started_at", since)
        .order("started_at", { ascending: false });
      if (live && data) setRows(data as unknown as FocusRow[]);
    };
    load();
    const ch = supabase
      .channel(`focus-hours:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "focus_sessions" }, () =>
        load(),
      )
      .subscribe();
    const iv = setInterval(load, 60_000);
    return () => {
      live = false;
      supabase.removeChannel(ch);
      clearInterval(iv);
    };
  }, [key]);

  return useMemo(() => {
    const now = Date.now();
    const days = Array.from({ length: 5 }, (_, i) => subDays(startOfDay(new Date()), 4 - i));
    const perUser: Record<string, { daily: number[]; week: number; today: number }> = {};
    for (const id of userIds.filter(Boolean)) {
      perUser[id] = { daily: days.map(() => 0), week: 0, today: 0 };
    }
    const weekStart = subDays(startOfDay(new Date()), 6).getTime();
    for (const row of rows) {
      const mins = minutesFor(row, now);
      if (mins <= 0) continue;
      const started = new Date(row.started_at);
      for (const id of participants(row)) {
        const bucket = perUser[id];
        if (!bucket) continue;
        const idx = days.findIndex((d) => isSameDay(d, started));
        if (idx >= 0) bucket.daily[idx] += mins;
        if (started.getTime() >= weekStart) bucket.week += mins;
        if (isSameDay(started, new Date())) bucket.today += mins;
      }
    }
    return { days, perUser };
  }, [rows, key]);
}

function fmt(mins: number) {
  const m = Math.round(mins);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

export function StudyHoursCard({ me, partner }: { me: Person; partner: Person }) {
  const ids = [me?.id, partner?.id].filter(Boolean) as string[];
  const { days, perUser } = useStudyHours(ids);

  const people = [
    { profile: me, label: "You", accent: "bg-gradient-abhay" as const },
    { profile: partner, label: "Study partner", accent: "bg-gradient-aishwarya" as const },
  ].filter((p) => p.profile);

  const max = Math.max(
    30,
    ...ids.flatMap((id) => perUser[id]?.daily ?? [0]),
  );

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-card md:p-8">
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-aurora opacity-20 blur-3xl" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground">
            <Timer className="h-3.5 w-3.5 text-primary" />
            Focus hours
          </div>
          <h3 className="mt-3 font-display text-2xl font-bold tracking-tight">
            Time on the <span className="text-gradient">clock.</span>
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Counted from focus sessions — only the minutes actually studied.
          </p>
        </div>
        <img
          src={clayGirl}
          alt=""
          aria-hidden
          width={768}
          height={768}
          loading="lazy"
          className="clay-character hidden h-24 w-24 shrink-0 drop-shadow-lg sm:block"
        />
      </div>

      <div className="relative mt-6 grid gap-4 md:grid-cols-2">
        {people.map(({ profile, label, accent }) => {
          const stats = perUser[profile!.id] ?? { daily: days.map(() => 0), week: 0, today: 0 };
          return (
            <div
              key={profile!.id}
              className="relative overflow-hidden rounded-2xl border border-border bg-background/50 p-5"
            >
              <div
                className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full ${accent} opacity-20 blur-3xl`}
              />
              <div className="relative flex items-center gap-3">
                <UserAvatar profile={profile as never} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {label}
                  </div>
                  <div className="truncate font-display text-base font-semibold">
                    {profile!.name}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-display text-xl font-bold tabular-nums">
                    {fmt(stats.week)}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    This week
                  </div>
                </div>
              </div>

              <div className="relative mt-5 flex items-end justify-between gap-2">
                {days.map((d, i) => {
                  const mins = stats.daily[i] ?? 0;
                  const h = Math.max(6, Math.round((mins / max) * 84));
                  return (
                    <div key={d.toISOString()} className="flex flex-1 flex-col items-center gap-1.5">
                      <div className="text-[10px] font-semibold tabular-nums text-muted-foreground">
                        {mins > 0 ? fmt(mins) : "—"}
                      </div>
                      <div className="flex h-[88px] w-full items-end">
                        <div
                          className={`w-full rounded-xl ${accent} shadow-card transition-all duration-700 ${
                            mins > 0 ? "opacity-90" : "opacity-25"
                          }`}
                          style={{ height: `${h}px` }}
                        />
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {format(d, "EEEEE")}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="relative mt-4 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
                <Clock3 className="h-3.5 w-3.5 text-primary" />
                Today: <span className="font-semibold text-foreground">{fmt(stats.today)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
