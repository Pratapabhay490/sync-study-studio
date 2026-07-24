import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export interface XpTotals {
  user_id: string;
  total_xp: number;
  level: number;
}

// Matches SQL: level = floor(sqrt(xp/50)) + 1, min 1
export function xpToLevel(xp: number) {
  return Math.max(1, Math.floor(Math.sqrt(Math.max(0, xp) / 50)) + 1);
}
export function xpForLevel(level: number) {
  const l = Math.max(1, level) - 1;
  return l * l * 50;
}
export function levelProgress(xp: number) {
  const level = xpToLevel(xp);
  const cur = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const inLevel = xp - cur;
  const span = next - cur;
  return {
    level,
    xp,
    into: inLevel,
    span,
    pct: Math.max(0, Math.min(100, (inLevel / span) * 100)),
    nextAt: next,
  };
}

export const LEVEL_TITLES = [
  "Newcomer",
  "Fresh Focus",
  "Steady",
  "Sharp",
  "Sharper",
  "Scholar",
  "Rising Star",
  "Physician-in-Training",
  "Diagnostician",
  "Attending",
  "Legend",
] as const;

export function levelTitle(level: number) {
  return LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)] ?? "Legend";
}

export function useXpFor(userIds: string[]) {
  const [rows, setRows] = useState<Record<string, XpTotals>>({});
  const key = userIds.join(",");
  useEffect(() => {
    if (!userIds.length) return;
    let live = true;
    const load = async () => {
      const { data } = await supabase
        .from("user_xp_totals")
        .select("*")
        .in("user_id", userIds);
      if (!live || !data) return;
      const next: Record<string, XpTotals> = {};
      for (const r of data as XpTotals[]) next[r.user_id] = r;
      setRows(next);
    };
    load();
    const ch = supabase
      .channel("xp-watch-" + key)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_xp_events" },
        (payload) => {
          const r: any = payload.new;
          if (r && userIds.includes(r.user_id)) load();
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

export function useMyXp() {
  const { user } = useAuth();
  const rows = useXpFor(user ? [user.id] : []);
  return user ? rows[user.id] ?? { user_id: user.id, total_xp: 0, level: 1 } : null;
}

/** Smoothly animates a number over ~600ms. */
export function useCountUp(value: number, duration = 600) {
  const [n, setN] = useState(value);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const from = n;
    const to = value;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      setN(Math.round(from + (to - from) * eased));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return n;
}
