import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export type PresenceStatus = "online" | "studying" | "break" | "offline";

export interface PresenceRow {
  user_id: string;
  status: PresenceStatus;
  current_activity: string | null;
  updated_at: string;
}

export function statusDot(status: PresenceStatus, updated_at?: string) {
  const stale =
    updated_at && Date.now() - new Date(updated_at).getTime() > 3 * 60 * 1000;
  if (stale) return { color: "bg-muted-foreground/40", label: "Offline" };
  switch (status) {
    case "studying":
      return { color: "bg-emerald-500 animate-pulse", label: "Studying" };
    case "break":
      return { color: "bg-amber-500", label: "On a break" };
    case "online":
      return { color: "bg-sky-500", label: "Online" };
    default:
      return { color: "bg-muted-foreground/40", label: "Offline" };
  }
}

/** Sends a presence heartbeat every 45s while mounted. */
export function usePresenceHeartbeat(status: PresenceStatus = "online", activity?: string) {
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const beat = async () => {
      if (cancelled) return;
      await supabase.rpc("heartbeat_presence", { p_status: status, p_activity: activity ?? null });
    };
    beat();
    const iv = setInterval(beat, 45_000);
    const onVis = () => {
      if (document.visibilityState === "visible") beat();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
      // best-effort mark offline
      supabase.rpc("heartbeat_presence", { p_status: "offline", p_activity: null });
    };
  }, [user, status, activity]);
}

export function usePresence(userIds: string[]) {
  const [rows, setRows] = useState<Record<string, PresenceRow>>({});
  const key = userIds.join(",");
  useEffect(() => {
    if (!userIds.length) return;
    let live = true;
    supabase
      .from("presence")
      .select("*")
      .in("user_id", userIds)
      .then(({ data }) => {
        if (!live || !data) return;
        const next: Record<string, PresenceRow> = {};
        for (const r of data as PresenceRow[]) next[r.user_id] = r;
        setRows(next);
      });
    const ch = supabase
      .channel("presence-watch")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "presence" },
        (payload) => {
          const r = payload.new as PresenceRow;
          if (r && userIds.includes(r.user_id)) {
            setRows((prev) => ({ ...prev, [r.user_id]: r }));
          }
        },
      )
      .subscribe();
    return () => {
      live = false;
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return rows;
}

export function useTodayCheckins(userIds: string[]) {
  const [rows, setRows] = useState<Record<string, any>>({});
  const key = userIds.join(",");
  useEffect(() => {
    if (!userIds.length) return;
    let live = true;
    const load = async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("daily_checkins")
        .select("*")
        .in("user_id", userIds)
        .eq("date", today);
      if (!live || !data) return;
      const next: Record<string, any> = {};
      for (const r of data) next[r.user_id] = r;
      setRows(next);
    };
    load();
    const ch = supabase
      .channel("checkin-watch")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "daily_checkins" },
        () => load(),
      )
      .subscribe();
    return () => {
      live = false;
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return rows;
}

export function useActiveFocusSession(userIds: string[]) {
  const [session, setSession] = useState<any | null>(null);
  const key = userIds.join(",");
  useEffect(() => {
    if (!userIds.length) return;
    let live = true;
    const load = async () => {
      const { data } = await supabase
        .from("focus_sessions")
        .select("*")
        .in("state", ["studying", "break"])
        .gt("ends_at", new Date().toISOString())
        .order("started_at", { ascending: false })
        .limit(1);
      if (!live) return;
      setSession(data && data.length ? data[0] : null);
    };
    load();
    const ch = supabase
      .channel("focus-watch")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "focus_sessions" },
        () => load(),
      )
      .subscribe();
    const iv = setInterval(load, 30_000);
    return () => {
      live = false;
      supabase.removeChannel(ch);
      clearInterval(iv);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return session;
}

export type ReactionKind = "cheer" | "keep_going" | "proud" | "congrats" | "high_five";
export const REACTION_META: Record<ReactionKind, { emoji: string; label: string }> = {
  cheer: { emoji: "🎉", label: "Cheer" },
  keep_going: { emoji: "💪", label: "Keep going" },
  proud: { emoji: "🌟", label: "Proud of you" },
  congrats: { emoji: "🎊", label: "Congrats" },
  high_five: { emoji: "✋", label: "High five" },
};

export async function sendReaction(toUserId: string, kind: ReactionKind, note?: string) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("not signed in");
  const { error } = await supabase.from("reactions").insert({
    from_user: u.user.id,
    to_user: toUserId,
    kind,
    context: note ? { note } : {},
  });
  if (error) throw error;
  // flush push immediately
  supabase.functions.invoke("send-push", { body: {} }).catch(() => {});
}
