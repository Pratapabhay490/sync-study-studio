/**
 * mascot-brain — Freddy's brain.
 *
 * MascotProvider subscribes to mascotEvents and turns app activity into
 * mood / bubble state. Freddy stays parked top-center and animates in place;
 * there is no walking, perching, or roaming. It also personalizes from
 * useData(): topics completed today and the study streak, with first-of-day
 * and streak-milestone celebrations. Guests (empty progress) simply stay quiet.
 *
 * All timers are cleaned up on unmount; mood auto-reverts after its
 * duration, and 90s without any event puts the mascot to sleep.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { parseISO, startOfDay, subDays } from "date-fns";
import { useAuth } from "@/lib/auth-context";
import { useData, type TopicProgress } from "@/lib/data-context";
import { mascotEvents, type MascotEvent } from "./mascot-events";

export type MascotMood =
  | "idle"
  | "happy"
  | "cheering"
  | "sleepy"
  | "studying"
  | "peeking"
  | "listening"
  | "thinking"
  | "dancing"
  | "waving";

interface MascotContextValue {
  mood: MascotMood;
  bubble: string | null;
  dispatch: (e: MascotEvent) => void;
}

const MascotContext = createContext<MascotContextValue | undefined>(undefined);

const HAPPY_BUBBLES = ["Nice tick!", "One down!", "+1 brain cell", "Keep rolling!"];
const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100];
const IDLE_MS = 90_000;

/** Consecutive days (ending today) with at least one completed topic. */
function computeStreak(userId: string, progress: TopicProgress[]): number {
  const days = new Set(
    progress
      .filter((p) => p.user_id === userId && p.completed && p.completed_at)
      .map((p) => startOfDay(parseISO(p.completed_at!)).toISOString()),
  );
  let s = 0;
  let d = startOfDay(new Date());
  while (days.has(d.toISOString())) {
    s++;
    d = subDays(d, 1);
  }
  return s;
}

function isToday(iso: string | null): boolean {
  if (!iso) return false;
  return startOfDay(parseISO(iso)).getTime() === startOfDay(new Date()).getTime();
}

export function MascotProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { progress } = useData();

  const [mood, setMood] = useState<MascotMood>("idle");
  const [bubble, setBubble] = useState<string | null>(null);

  const moodTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moodRef = useRef<MascotMood>("idle");
  const greetedRef = useRef(false);
  const topicsTodayRef = useRef(0);

  useEffect(() => {
    moodRef.current = mood;
  }, [mood]);

  const clearAllTimers = useCallback(() => {
    for (const t of [moodTimer, bubbleTimer, idleTimer]) {
      if (t.current) clearTimeout(t.current);
      t.current = null;
    }
  }, []);

  /** Show a mood for `ms`, then fall back to idle. */
  const showMood = useCallback((m: MascotMood, ms: number) => {
    if (moodTimer.current) clearTimeout(moodTimer.current);
    setMood(m);
    moodTimer.current = setTimeout(() => {
      setMood("idle");
    }, ms);
  }, []);

  const showBubble = useCallback((text: string, ms: number) => {
    if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
    setBubble(text);
    bubbleTimer.current = setTimeout(() => setBubble(null), ms);
  }, []);

  const armIdle = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      setMood("sleepy");
    }, IDLE_MS);
  }, []);

  // ---- personalization -------------------------------------------------
  const topicsToday = useMemo(
    () =>
      user
        ? progress.filter(
            (p) => p.user_id === user.id && p.completed && isToday(p.completed_at),
          ).length
        : 0,
    [user, progress],
  );
  const streak = useMemo(
    () => (user ? computeStreak(user.id, progress) : 0),
    [user, progress],
  );

  useEffect(() => {
    topicsTodayRef.current = topicsToday;
  }, [topicsToday]);

  // ---- event subscription ----------------------------------------------
  useEffect(() => {
    armIdle();
    const off = mascotEvents.subscribe((e) => {
      armIdle();
      if (!user) return; // no user → stay idle, no bubbles
      if (moodRef.current === "sleepy") setMood("idle"); // any event wakes

      switch (e.type) {
        case "topic:completed":
          showMood("happy", 2500);
          showBubble(
            HAPPY_BUBBLES[Math.floor(Math.random() * HAPPY_BUBBLES.length)],
            2500,
          );
          break;
        case "task:completed":
          showMood("happy", 2500);
          break;
        case "badge:earned":
          showMood("cheering", 5000);
          showBubble("Badge unlocked!", 5000);
          break;
        case "focus:started":
          if (moodTimer.current) clearTimeout(moodTimer.current);
          setMood("studying");
          showBubble("Locking in with you.", 4000);
          break;
        case "focus:ended":
          showMood("cheering", 4000);
          showBubble("Session done — proud of you!", 4000);
          break;
        case "streak:milestone":
          if (e.days >= 14) {
            showMood("dancing", 5000);
            showBubble(`🔥 ${e.days}-day streak — dance break!`, 5000);
          } else {
            showMood("cheering", 5000);
            showBubble(`🔥 ${e.days}-day streak!`, 5000);
          }
          break;
        case "quiz:generating":
          showMood("thinking", 6000);
          showBubble("Cooking up questions…", 5000);
          break;
        case "app:foregrounded":
          // Wave — "oh, you're back!"
          showMood("waving", 2600);
          break;
        case "poke": {
          const n = topicsTodayRef.current;
          showMood("listening", 2500);
          showBubble(
            n > 0
              ? `${n} topic${n === 1 ? "" : "s"} down today — beast mode.`
              : "Tick a topic and watch me dance.",
            3000,
          );
          break;
        }
      }
    });
    return () => {
      off();
      clearAllTimers();
    };
  }, [user, armIdle, showMood, showBubble, clearAllTimers]);

  // ---- mount greeting: once per session --------------------------------
  useEffect(() => {
    if (greetedRef.current || !user) return;
    greetedRef.current = true;
    showMood("waving", 2200);
    showBubble("Hey! Ready to lock in?", 4000);
  }, [user, showBubble, showMood]);

  // ---- wave when the app returns from background -----------------------
  useEffect(() => {
    let hiddenAt = 0;
    const onVis = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
      } else if (hiddenAt && Date.now() - hiddenAt > 20_000) {
        hiddenAt = 0;
        mascotEvents.emit({ type: "app:foregrounded" });
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // ---- first topic of the day -------------------------------------------
  const prevTopicsToday = useRef(topicsToday);
  useEffect(() => {
    if (user && prevTopicsToday.current === 0 && topicsToday === 1) {
      showMood("cheering", 4000);
      showBubble("First one today — let's go!", 4000);
    }
    prevTopicsToday.current = topicsToday;
  }, [topicsToday, user, showMood, showBubble]);

  // ---- streak milestones -------------------------------------------------
  const prevStreak = useRef(streak);
  useEffect(() => {
    const prev = prevStreak.current;
    if (user && streak > prev && STREAK_MILESTONES.includes(streak)) {
      if (streak >= 14) {
        showMood("dancing", 5000);
        showBubble(`🔥 ${streak}-day streak — dance break!`, 5000);
      } else {
        showMood("cheering", 5000);
        showBubble(`🔥 ${streak}-day streak!`, 5000);
      }
    }
    prevStreak.current = streak;
  }, [streak, user, showMood, showBubble]);

  const dispatch = useCallback((e: MascotEvent) => {
    mascotEvents.emit(e);
  }, []);

  const value = useMemo<MascotContextValue>(
    () => ({ mood, bubble, dispatch }),
    [mood, bubble, dispatch],
  );

  return <MascotContext.Provider value={value}>{children}</MascotContext.Provider>;
}

export function useMascot(): MascotContextValue {
  const ctx = useContext(MascotContext);
  if (!ctx) throw new Error("useMascot must be used within MascotProvider");
  return ctx;
}
