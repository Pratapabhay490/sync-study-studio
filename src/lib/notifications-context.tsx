import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth-context";

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
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported",
  );
  const seenIds = useRef<Set<string>>(new Set());

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
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, 100))); } catch { /* ignore */ }
  }, [notifications]);

  const push = useCallback((n: AppNotification) => {
    setNotifications((prev) => [n, ...prev].slice(0, 100));
    playChime();
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
        const row = (payload.new ?? payload.old) as { id: string; topic_id: string; user_id: string; completed: boolean } | null;
        if (!row) return;
        if (row.user_id === user.id) return;
        if (!row.completed) return;
        const key = `${row.id}:${row.completed}`;
        if (seenIds.current.has(key)) return;
        seenIds.current.add(key);

        // fetch context
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
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, push]);

  const requestPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const p = await Notification.requestPermission();
    setPermission(p);
  }, []);

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
