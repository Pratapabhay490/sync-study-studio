import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useData } from "@/lib/data-context";
import { UserAvatar } from "@/components/user-avatar";
import { useBadgeCatalog, tierClass } from "@/lib/badges";
import { formatDistanceToNow, parseISO } from "date-fns";
import { Sparkles, Trophy, Zap, Flame, Users, Filter } from "lucide-react";

export const Route = createFileRoute("/_authenticated/journey")({
  head: () => ({
    meta: [
      { title: "Journey — Let's be in sync" },
      { name: "description", content: "The shared timeline of your study partnership." },
    ],
  }),
  component: JourneyPage,
});

type Filter = "all" | "yours" | "partner" | "badges";

function JourneyPage() {
  const { user } = useAuth();
  const { profiles } = useData();
  const me = profiles.find((p) => p.id === user?.id);
  const other = profiles.find((p) => p.id !== user?.id);
  const catalog = useBadgeCatalog();
  const userIds = useMemo(() => [me?.id, other?.id].filter(Boolean) as string[], [me, other]);
  const [xpEvents, setXpEvents] = useState<any[]>([]);
  const [badges, setBadges] = useState<any[]>([]);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    if (!userIds.length) return;
    let live = true;
    const load = async () => {
      const [{ data: xp }, { data: bd }] = await Promise.all([
        supabase
          .from("user_xp_events")
          .select("*")
          .in("user_id", userIds)
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("user_badges")
          .select("*")
          .in("user_id", userIds)
          .order("unlocked_at", { ascending: false }),
      ]);
      if (!live) return;
      setXpEvents(xp ?? []);
      setBadges(bd ?? []);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIds.join(",")]);

  const items = useMemo(() => {
    const merged: any[] = [];
    for (const e of xpEvents) {
      if (e.kind?.startsWith("badge:")) continue; // shown separately
      merged.push({ type: "xp", at: e.created_at, row: e });
    }
    for (const b of badges) {
      merged.push({ type: "badge", at: b.unlocked_at, row: b });
    }
    merged.sort((a, b) => (b.at > a.at ? 1 : -1));
    return merged.filter((it) => {
      if (filter === "all") return true;
      if (filter === "badges") return it.type === "badge";
      if (filter === "yours") return it.row.user_id === user?.id;
      if (filter === "partner") return it.row.user_id === other?.id;
      return true;
    });
  }, [xpEvents, badges, filter, user, other]);

  return (
    <div className="space-y-6">
      <div className="clay p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold">Your journey <span className="text-gradient">together</span></h1>
            <p className="text-sm text-muted-foreground">
              Every topic, quiz, and badge — the story of you two.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["all", "yours", "partner", "badges"] as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  filter === f
                    ? "bg-gradient-primary text-white shadow-clay-sm"
                    : "bg-muted/60 text-foreground/70 hover:bg-primary/10"
                }`}
              >
                <Filter className="h-3 w-3" />
                {f === "all" ? "All" : f === "yours" ? "You" : f === "partner" ? "Partner" : "Badges"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="clay p-6">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Your timeline is empty for now. Finish a topic to plant the first pin 🌱
          </p>
        ) : (
          <ol className="relative border-l-2 border-dashed border-border/60 pl-6">
            {items.map((it, i) => {
              const profile = it.row.user_id === user?.id ? me : other;
              const meta = it.type === "badge" ? catalog[it.row.badge_key] : null;
              return (
                <li key={i} className="mb-6 last:mb-0">
                  <span className="absolute -left-3 grid h-6 w-6 place-items-center rounded-full bg-gradient-primary text-white shadow-clay-sm">
                    {it.type === "badge" ? (
                      <Trophy className="h-3 w-3" />
                    ) : it.row.kind === "topic_complete" ? (
                      <Sparkles className="h-3 w-3" />
                    ) : it.row.kind === "focus_session" ? (
                      <Users className="h-3 w-3" />
                    ) : it.row.kind === "subject_complete" ? (
                      <Flame className="h-3 w-3" />
                    ) : (
                      <Zap className="h-3 w-3" />
                    )}
                  </span>
                  <div className="clay-pressed flex items-start gap-3 p-3">
                    <UserAvatar profile={profile} size={32} />
                    <div className="min-w-0 flex-1">
                      {it.type === "badge" && meta ? (
                        <div className="flex items-center gap-2">
                          <div
                            className={`grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br text-lg ${tierClass(meta.tier)}`}
                          >
                            {meta.emoji}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-bold">
                              {profile?.name?.split(" ")[0]} unlocked {meta.title}
                            </div>
                            <div className="truncate text-xs text-muted-foreground">{meta.description}</div>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="truncate text-sm font-semibold">
                            {profile?.name?.split(" ")[0]} — {prettyKind(it.row.kind)}{" "}
                            <span className="text-primary">+{it.row.amount} XP</span>
                          </div>
                        </div>
                      )}
                      <div className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                        {formatDistanceToNow(parseISO(it.at), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}

function prettyKind(k: string) {
  switch (k) {
    case "topic_complete": return "finished a topic";
    case "subject_complete": return "finished a whole subject 🏆";
    case "quiz_correct": return "answered a quiz question correctly";
    case "quiz_bonus": return "aced a quiz";
    case "focus_session": return "wrapped a focus session";
    case "night_goal_hit": return "hit today's night goal";
    case "reaction_sent": return "sent a lift to their partner";
    case "weekly_challenge": return "cleared the weekly challenge";
    default: return k.replace(/_/g, " ");
  }
}
