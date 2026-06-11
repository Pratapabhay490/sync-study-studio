import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth-context";
import { useData } from "./data-context";
import { toast } from "sonner";
import { isToday, parseISO } from "date-fns";

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  subjectId?: string | null;
  topicId?: string | null;
  createdAt: number;
  read: boolean;
}

interface Ctx {
  notifications: AppNotification[];
  unread: number;
  permission: NotificationPermission | "unsupported";
  requestPermission: () => Promise<void>;
  markAllRead: () => void;
  markRead: (id: string) => void;
  clearAll: () => void;
}

const NotificationsContext = createContext<Ctx | undefined>(undefined);
const STORAGE_KEY = "lbis_notifications_v1";
const MOTIVATION_KEY = "lbis_motivation_last_v1";
const PERM_ASK_KEY = "lbis_perm_asked_v1";

const MOTIVATIONS_LOW = [
  "Open one topic. Just one. Future you will thank you.",
  "A blank day is the easiest to fix — tick one box.",
  "Tiny effort beats zero effort. Pick a topic now.",
];
const MOTIVATIONS_MID = [
  "You're rolling. Two more topics and today is a win.",
  "Momentum looks good — keep syncing with your partner.",
  "Halfway through the day's grind. Don't slow down now.",
];
const MOTIVATIONS_HIGH = [
  "Beast mode unlocked. Cap the day strong.",
  "Your partner can feel the streak — keep leading.",
  "This is the version of you NEET PG fears. Continue.",
];

function pickMotivation(doneToday: number) {
  const pool = doneToday === 0 ? MOTIVATIONS_LOW : doneToday < 4 ? MOTIVATIONS_MID : MOTIVATIONS_HIGH;
  return pool[Math.floor(Math.random() * pool.length)];
}

function playChime() {
  try {
    const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    const ctx = new AC();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = "sine";
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.18);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    o.start();
    o.stop(ctx.currentTime + 0.55);
  } catch { /* ignore */ }
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { progress } = useData();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported",
  );
  const seenIds = useRef<Set<string>>(new Set());
  const mounted = useRef(false);

  // Load persisted
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AppNotification[];
        setNotifications(parsed);
        parsed.forEach((n) => seenIds.current.add(n.id));
      }
    } catch { /* ignore */ }
    // Mark mounted on the next tick so initial realtime backlog doesn't toast
    setTimeout(() => { mounted.current = true; }, 1500);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, 100))); } catch { /* ignore */ }
  }, [notifications]);

  const requestPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const p = await Notification.requestPermission();
    setPermission(p);
  }, []);

  // Auto-request permission once after login (non-blocking, after a short delay)
  useEffect(() => {
    if (!user) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "default") return;
    if (localStorage.getItem(PERM_ASK_KEY)) return;
    const t = setTimeout(() => {
      localStorage.setItem(PERM_ASK_KEY, "1");
      Notification.requestPermission().then(setPermission).catch(() => {});
    }, 4000);
    return () => clearTimeout(t);
  }, [user]);

  const push = useCallback((n: AppNotification, options?: { silent?: boolean }) => {
    setNotifications((prev) => {
      if (prev.some((x) => x.id === n.id)) return prev;
      return [n, ...prev].slice(0, 100);
    });
    if (options?.silent) return;
    playChime();
    // In-app toast
    toast(n.title, { description: n.body });
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      try {
        const note = new Notification(n.title, { body: n.body, tag: n.id, icon: "/favicon.ico", badge: "/favicon.ico" });
        note.onclick = () => {
          window.focus();
          if (n.subjectId) window.location.assign(`/subjects/${n.subjectId}`);
          note.close();
        };
      } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("notify-progress")
      .on("postgres_changes", { event: "*", schema: "public", table: "topic_progress" }, async (payload) => {
        const row = (payload.new ?? payload.old) as { id: string; topic_id: string; user_id: string; completed: boolean; completed_at?: string | null } | null;
        if (!row) return;
        if (row.user_id === user.id) return;
        if (!row.completed) return;
        // ignore very old completions (avoid backlog noise)
        if (row.completed_at) {
          const age = Date.now() - new Date(row.completed_at).getTime();
          if (age > 5 * 60 * 1000) return;
        }
        const key = `partner:${row.id}:${row.completed_at ?? ""}`;
        if (seenIds.current.has(key)) return;
        seenIds.current.add(key);

        const [{ data: prof }, { data: topic }] = await Promise.all([
          supabase.from("profiles").select("name").eq("id", row.user_id).maybeSingle(),
          supabase.from("topics").select("topic_name, subject_id, subjects(name)").eq("id", row.topic_id).maybeSingle(),
        ]);
        const who = prof?.name?.split(" ")[0] ?? "Your partner";
        const topicName = topic?.topic_name ?? "a topic";
        const subj = (topic as unknown as { subjects?: { name?: string } } | null)?.subjects?.name;
        push({
          id: key,
          title: `${who} completed ${topicName}`,
          body: subj ? `in ${subj} · keep the streak going!` : "Keep the streak going!",
          subjectId: topic?.subject_id ?? null,
          topicId: row.topic_id,
          createdAt: Date.now(),
          read: false,
        }, { silent: !mounted.current });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, push]);

  // Motivational push — periodic, based on today's progress
  useEffect(() => {
    if (!user) return;
    if (typeof window === "undefined") return;
    const tick = () => {
      const last = Number(localStorage.getItem(MOTIVATION_KEY) || 0);
      const gap = Date.now() - last;
      // at most once every 90 minutes
      if (gap < 90 * 60 * 1000) return;
      const doneToday = progress.filter(
        (p) => p.user_id === user.id && p.completed && p.completed_at && isToday(parseISO(p.completed_at)),
      ).length;
      const body = pickMotivation(doneToday);
      const title = doneToday === 0 ? "Let's get the first one in" : doneToday < 4 ? "Don't break the rhythm" : "Closing strong";
      localStorage.setItem(MOTIVATION_KEY, String(Date.now()));
      push({
        id: `mot:${Date.now()}`,
        title,
        body,
        createdAt: Date.now(),
        read: false,
      });
    };
    // initial check after 2 min, then every 30 min
    const t1 = setTimeout(tick, 2 * 60 * 1000);
    const t2 = setInterval(tick, 30 * 60 * 1000);
    return () => { clearTimeout(t1); clearInterval(t2); };
  }, [user, progress, push]);

  const markAllRead = useCallback(() => setNotifications((prev) => prev.map((n) => ({ ...n, read: true }))), []);
  const markRead = useCallback((id: string) => setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n))), []);
  const clearAll = useCallback(() => setNotifications([]), []);

  const unread = notifications.filter((n) => !n.read).length;

  const value = useMemo<Ctx>(() => ({ notifications, unread, permission, requestPermission, markAllRead, markRead, clearAll }),
    [notifications, unread, permission, requestPermission, markAllRead, markRead, clearAll]);
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
}
