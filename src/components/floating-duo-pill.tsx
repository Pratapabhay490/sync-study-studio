/**
 * floating-duo-pill — a small floating pill pinned to the top of every signed-in
 * page that shows both partners' mascots live: studying together during a focus
 * block, dozing when offline, bouncing when a topic gets ticked. Tap to expand.
 */
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Flame, Timer } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useData } from "@/lib/data-context";
import { useSoloMode } from "@/lib/solo-mode";
import { PRESENCE_STALE_MS, statusDot, useActiveFocusSession, usePresence } from "@/lib/partner";
import { LivingAvatar } from "@/components/living-avatar";
import { PokeButton } from "@/components/poke-button";
import { useMascot, type MascotMood } from "@/components/study-mascot/mascot-brain";
import { cn } from "@/lib/utils";

function useNow(ms: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function FloatingDuoPill() {
  const { user, isGuest } = useAuth();
  const { profiles, progress } = useData();
  const { solo } = useSoloMode();
  const { mood: myMood } = useMascot();
  const [open, setOpen] = useState(false);

  const me = profiles.find((p) => p.id === user?.id);
  const other = solo ? undefined : profiles.find((p) => p.id !== user?.id);
  const ids = useMemo(() => [me?.id, other?.id].filter(Boolean) as string[], [me?.id, other?.id]);
  const presence = usePresence(ids);
  const session = useActiveFocusSession(ids);
  const now = useNow(1000);

  // Partner bounces for a few seconds after ticking a topic.
  const [partnerCheer, setPartnerCheer] = useState(false);
  const otherDone = other ? progress.filter((p) => p.user_id === other.id && p.completed).length : 0;
  const prevDone = useRef<number | null>(null);
  useEffect(() => {
    if (prevDone.current !== null && otherDone > prevDone.current) {
      setPartnerCheer(true);
      const t = setTimeout(() => setPartnerCheer(false), 6000);
      prevDone.current = otherDone;
      return () => clearTimeout(t);
    }
    prevDone.current = otherDone;
  }, [otherDone]);

  if (!user || isGuest || !me) return null;

  const op = other ? presence[other.id] : undefined;
  const otherOnline = !!op && now - new Date(op.updated_at).getTime() <= PRESENCE_STALE_MS;
  const focusLeft = session ? Math.max(0, new Date(session.ends_at).getTime() - now) : 0;
  const focusing = focusLeft > 0;
  // A running focus block means the partner is studying, even if their presence went stale.
  const otherStudying = (!!other && focusing) || (otherOnline && op?.status === "studying");

  const partnerMood: MascotMood = partnerCheer
    ? "cheering"
    : otherStudying
      ? "studying"
      : !otherOnline
        ? "sleepy"
        : op?.status === "break"
          ? "idle"
          : "waving";

  const mm = Math.floor(focusLeft / 60000);
  const ss = Math.floor((focusLeft % 60000) / 1000).toString().padStart(2, "0");
  const bothStudying = focusing && otherStudying && myMood === "studying";

  const myDays = progress.filter((p) => p.user_id === me.id && p.completed && p.completed_at)
    .filter((p) => new Date(p.completed_at!).toDateString() === new Date(now).toDateString()).length;

  const bridge = focusing ? (
    <span className="flex items-center gap-1 tabular-nums text-emerald-600 dark:text-emerald-400">
      <Timer className="h-3.5 w-3.5" />
      {mm}:{ss}
    </span>
  ) : (
    <span className="flex items-center gap-1 text-muted-foreground">
      <Flame className="h-3.5 w-3.5 text-orange-500" />
      {myDays} today
    </span>
  );

  const otherLabel = other ? statusDot(op?.status ?? "offline", op?.updated_at).label : null;
  const story = !other
    ? "Solo grind — you've got this."
    : bothStudying
      ? "Studying side by side"
      : partnerCheer
        ? `${other.name} just ticked a topic!`
        : otherStudying
          ? `${other.name} is locked in`
          : !otherOnline
            ? `${other.name} is snoozing — send a nudge`
            : `${other.name} is around`;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[4.6rem] z-30 flex justify-center px-4 md:left-72 md:top-4">
      <div className="pointer-events-auto relative">
        <motion.div
          role="button"
          tabIndex={0}
          aria-expanded={open}
          aria-label="Study duo status"
          onClick={() => setOpen((o) => !o)}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setOpen((o) => !o)}
          initial={{ y: -16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className={cn(
            "flex cursor-pointer items-center gap-2 rounded-full border border-border/50 bg-card/85 py-1 pl-1 pr-1 shadow-clay-sm backdrop-blur-md",
            bothStudying && "ring-2 ring-emerald-400/50",
          )}
        >
          <LivingAvatar profile={me} size={34} hideBubble />
          <div className="relative flex items-center px-1 text-xs font-semibold">
            {other && (
              <motion.span
                aria-hidden
                className={cn("absolute inset-x-0 top-1/2 -z-10 h-0.5 rounded-full", focusing ? "bg-emerald-400/60" : "bg-border")}
                animate={focusing ? { opacity: [0.4, 1, 0.4] } : { opacity: 0.6 }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            )}
            <span className="rounded-full bg-card/90 px-1.5">{bridge}</span>
          </div>
          {other && (
            <LivingAvatar
              profile={other}
              size={34}
              mood={partnerMood}
              onTap={() => setOpen((o) => !o)}
              label={`${other.name}'s mascot`}
            />
          )}
        </motion.div>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.97 }}
              className="clay absolute left-1/2 top-full mt-2 w-72 -translate-x-1/2 p-4 text-sm"
            >
              <div className="flex items-end justify-center gap-6">
                <div className="flex flex-col items-center gap-1">
                  <LivingAvatar profile={me} size={64} hideBubble />
                  <span className="text-xs font-semibold">You</span>
                </div>
                {other && (
                  <div className="flex flex-col items-center gap-1">
                    <LivingAvatar profile={other} size={64} mood={partnerMood} onTap={() => {}} label={`${other.name}'s mascot`} />
                    <span className="text-xs font-semibold">{other.name}</span>
                    <span className="text-[10px] text-muted-foreground">{otherLabel}</span>
                  </div>
                )}
              </div>
              <p className="mt-3 text-center font-semibold">{story}</p>
              <div className="mt-3 flex items-center justify-center gap-2">
                {other && <PokeButton toUserId={other.id} toName={other.name} compact />}
                <Link
                  to="/home"
                  onClick={() => setOpen(false)}
                  className="rounded-full bg-gradient-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-clay-sm"
                >
                  {focusing ? "Open focus block" : "Start focus"}
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
