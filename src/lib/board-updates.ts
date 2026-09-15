import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type BoardKind = "daily" | "weekly";

/**
 * Tracks whether the study partner changed a task board since this user last
 * looked at it. The dot clears when the board scrolls into view.
 */
export function useBoardSeen(userId: string | undefined, board: BoardKind) {
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [changedAt, setChangedAt] = useState<string | null>(null);
  const seenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let live = true;
    (async () => {
      const { data } = await supabase
        .from("board_seen")
        .select("last_seen_at")
        .eq("user_id", userId)
        .eq("board", board)
        .maybeSingle();
      if (!live) return;
      const ts = (data as { last_seen_at?: string } | null)?.last_seen_at ?? null;
      seenRef.current = ts;
      setLastSeen(ts);
    })();
    return () => {
      live = false;
    };
  }, [userId, board]);

  /** Called by a board when a realtime change made by the partner arrives. */
  const notifyPartnerChange = useCallback((at?: string) => {
    const ts = at ?? new Date().toISOString();
    if (seenRef.current && ts <= seenRef.current) return;
    setChangedAt(ts);
  }, []);

  const markSeen = useCallback(async () => {
    if (!userId) return;
    const now = new Date().toISOString();
    seenRef.current = now;
    setLastSeen(now);
    setChangedAt(null);
    await supabase
      .from("board_seen")
      .upsert({ user_id: userId, board, last_seen_at: now }, { onConflict: "user_id,board" });
  }, [userId, board]);

  /** Attach to the board section so the hint clears once it's on screen. */
  const seenRefCallback = useCallback(
    (node: HTMLElement | null) => {
      if (!node || typeof IntersectionObserver === "undefined") return;
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            window.setTimeout(() => {
              if (document.visibilityState === "visible") markSeen();
            }, 1200);
            observer.disconnect();
          }
        },
        { threshold: 0.35 },
      );
      observer.observe(node);
    },
    [markSeen],
  );

  return {
    hasPartnerUpdate: Boolean(changedAt && (!lastSeen || changedAt > lastSeen)),
    notifyPartnerChange,
    markSeen,
    seenRefCallback,
  };
}

/** A soft pulsing dot shown next to a board title when the partner changed something. */
export const BOARD_HINT_CLASS =
  "relative inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-primary before:absolute before:inset-0 before:animate-ping before:rounded-full before:bg-primary/70";
