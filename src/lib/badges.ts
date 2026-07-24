import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Badge {
  key: string;
  title: string;
  description: string;
  emoji: string;
  tier: "bronze" | "silver" | "gold";
  xp_reward: number;
  sort_order: number;
}

export interface UserBadge {
  id: string;
  user_id: string;
  badge_key: string;
  context: any;
  unlocked_at: string;
}

export function tierClass(tier: string) {
  switch (tier) {
    case "gold":
      return "from-amber-400 to-orange-500 text-white";
    case "silver":
      return "from-slate-300 to-slate-500 text-white";
    default:
      return "from-orange-300 to-rose-400 text-white";
  }
}

export function useBadgeCatalog() {
  const [rows, setRows] = useState<Record<string, Badge>>({});
  useEffect(() => {
    let live = true;
    supabase
      .from("badges")
      .select("*")
      .order("sort_order")
      .then(({ data }) => {
        if (!live || !data) return;
        const map: Record<string, Badge> = {};
        for (const b of data as Badge[]) map[b.key] = b;
        setRows(map);
      });
    return () => {
      live = false;
    };
  }, []);
  return rows;
}

export function useUserBadges(userIds: string[]) {
  const [rows, setRows] = useState<UserBadge[]>([]);
  const key = userIds.join(",");
  useEffect(() => {
    if (!userIds.length) return;
    let live = true;
    const load = async () => {
      const { data } = await supabase
        .from("user_badges")
        .select("*")
        .in("user_id", userIds)
        .order("unlocked_at", { ascending: false });
      if (!live || !data) return;
      setRows(data as UserBadge[]);
    };
    load();
    const ch = supabase
      .channel("badge-watch-" + key)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "user_badges" },
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
