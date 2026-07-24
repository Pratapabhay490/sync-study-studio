import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useBadgeCatalog, tierClass } from "@/lib/badges";
import { celebrate } from "@/lib/celebrate";

interface Pending {
  badge_key: string;
  unlocked_at: string;
}

/** Listens for new badges awarded to the current user and shows a celebration modal. */
export function BadgePopup() {
  const { user } = useAuth();
  const catalog = useBadgeCatalog();
  const [queue, setQueue] = useState<Pending[]>([]);
  const [seenAt, setSeenAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!user) return;
    setSeenAt(new Date());
    const ch = supabase
      .channel("badge-popup-" + user.id)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "user_badges", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const r: any = payload.new;
          setQueue((q) => [...q, { badge_key: r.badge_key, unlocked_at: r.unlocked_at }]);
          celebrate();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user]);

  // Ignore badges unlocked before this mount (avoid spam on refresh)
  const current = queue.find((p) => !seenAt || new Date(p.unlocked_at) >= seenAt);
  const meta = current ? catalog[current.badge_key] : null;

  function dismiss() {
    setQueue((q) => q.slice(1));
  }

  return (
    <AnimatePresence>
      {current && meta && (
        <motion.div
          key={current.badge_key + current.unlocked_at}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] grid place-items-center bg-black/60 backdrop-blur-sm p-4"
          onClick={dismiss}
        >
          <motion.div
            initial={{ scale: 0.7, y: 40, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", damping: 18, stiffness: 220 }}
            className="clay relative overflow-hidden p-8 max-w-sm w-full text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pointer-events-none absolute inset-0 bg-gradient-primary opacity-10" />
            <div className="relative">
              <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Achievement unlocked</div>
              <div
                className={`mx-auto mt-4 grid h-24 w-24 place-items-center rounded-3xl bg-gradient-to-br text-5xl shadow-clay ${tierClass(meta.tier)} logo-breathe`}
              >
                {meta.emoji}
              </div>
              <h3 className="mt-4 font-display text-2xl font-bold">{meta.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{meta.description}</p>
              <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                +{meta.xp_reward} XP
              </div>
              <button
                type="button"
                onClick={dismiss}
                className="mt-6 w-full rounded-2xl bg-gradient-primary py-3 text-sm font-bold text-white shadow-clay-sm"
              >
                Nice
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
