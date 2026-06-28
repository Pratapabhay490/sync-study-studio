import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth-context";
import { toast } from "sonner";
import { VAPID_PUBLIC_KEY, urlBase64ToUint8Array } from "./push-config";

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  subjectId?: string | null;
  topicId?: string | null;
  createdAt: number;
  read: boolean;
  kind?: string;
}

interface Ctx {
  notifications: AppNotification[];
  unread: number;
  permission: NotificationPermission | "unsupported";
  pushEnabled: boolean;
  enablePush: () => Promise<boolean>;
  disablePush: () => Promise<void>;
  markAllRead: () => void;
  markRead: (id: string) => void;
  clearAll: () => void;
  sendTestPush: () => Promise<void>;
}

const NotificationsContext = createContext<Ctx | undefined>(undefined);
const STORAGE_KEY = "lbis_notifications_v2";

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
  const [pushEnabled, setPushEnabled] = useState(false);
  const seen = useRef<Set<string>>(new Set());
  const mounted = useRef(false);

  // Load persisted notification list
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AppNotification[];
        setNotifications(parsed);
        parsed.forEach((n) => seen.current.add(n.id));
      }
    } catch { /* ignore */ }
    setTimeout(() => { mounted.current = true; }, 1500);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, 120))); } catch { /* ignore */ }
  }, [notifications]);

  // Register service worker once
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  // Reflect current push subscription status
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready.then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setPushEnabled(!!sub)).catch(() => {});
  }, [user]);

  const persistSubscription = useCallback(async (sub: PushSubscription) => {
    if (!user) return;
    const json = sub.toJSON();
    const p256dh = json.keys?.p256dh ?? "";
    const auth = json.keys?.auth ?? "";
    if (!p256dh || !auth) return;
    await supabase.from("push_subscriptions").upsert({
      user_id: user.id,
      endpoint: sub.endpoint,
      p256dh,
      auth,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 200) : null,
    }, { onConflict: "endpoint" });
  }, [user]);

  const enablePush = useCallback(async (): Promise<boolean> => {
    if (typeof window === "undefined") return false;
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      toast.error("Push notifications aren't supported on this browser.");
      return false;
    }
    const perm = await Notification.requestPermission();
    setPermission(perm);
    if (perm !== "granted") {
      toast.error("Notifications were blocked. Enable them in browser settings.");
      return false;
    }
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
      });
    }
    await persistSubscription(sub);
    setPushEnabled(true);
    toast.success("Push notifications enabled — even when this tab is closed.");
    return true;
  }, [persistSubscription]);

  const disablePush = useCallback(async () => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      await sub.unsubscribe();
    }
    setPushEnabled(false);
  }, []);

  // Auto-prompt once after login (gentle)
  useEffect(() => {
    if (!user) return;
    if (typeof window === "undefined") return;
    if (Notification.permission !== "default") return;
    if (localStorage.getItem("lbis_push_auto_ask_v2")) return;
    const t = setTimeout(() => {
      localStorage.setItem("lbis_push_auto_ask_v2", "1");
      enablePush().catch(() => {});
    }, 3500);
    return () => clearTimeout(t);
  }, [user, enablePush]);

  const push = useCallback((n: AppNotification, opts?: { silent?: boolean }) => {
    setNotifications((prev) => (prev.some((x) => x.id === n.id) ? prev : [n, ...prev].slice(0, 120)));
    if (opts?.silent) return;
    playChime();
    toast(n.title, { description: n.body });
  }, []);

  // Realtime: partner finishes a topic
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("notify-progress-v2")
      .on("postgres_changes", { event: "*", schema: "public", table: "topic_progress" }, async (payload) => {
        const row = (payload.new ?? payload.old) as
          | { id: string; topic_id: string; user_id: string; completed: boolean; completed_at?: string | null }
          | null;
        if (!row || row.user_id === user.id || !row.completed) return;
        if (row.completed_at && Date.now() - new Date(row.completed_at).getTime() > 5 * 60 * 1000) return;
        const key = `partner:${row.id}:${row.completed_at ?? ""}`;
        if (seen.current.has(key)) return;
        seen.current.add(key);
        const [{ data: prof }, { data: topic }] = await Promise.all([
          supabase.from("profiles").select("name").eq("id", row.user_id).maybeSingle(),
          supabase.from("topics").select("topic_name, subject_id, subjects(name)").eq("id", row.topic_id).maybeSingle(),
        ]);
        const who = prof?.name?.split(" ")[0] ?? "Your partner";
        const topicName = topic?.topic_name ?? "a topic";
        const subj = (topic as unknown as { subjects?: { name?: string } } | null)?.subjects?.name;
        push({
          id: key,
          title: `${who} completed ${topicName} 🎉`,
          body: subj ? `in ${subj} · keep the streak going!` : "Keep the streak going!",
          subjectId: topic?.subject_id ?? null,
          topicId: row.topic_id,
          createdAt: Date.now(),
          read: false,
          kind: "partner_complete",
        }, { silent: !mounted.current });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, push]);

  // Realtime: pokes
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("notify-pokes-v2")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "pokes", filter: `to_user=eq.${user.id}` },
        async (payload) => {
          const row = payload.new as { id: string; from_user: string; message: string };
          const { data: prof } = await supabase.from("profiles").select("name").eq("id", row.from_user).maybeSingle();
          const who = prof?.name?.split(" ")[0] ?? "Your partner";
          push({
            id: `poke:${row.id}`,
            title: `${who} poked you 👋`,
            body: row.message,
            createdAt: Date.now(),
            read: false,
            kind: "poke",
          });
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, push]);

  // Realtime: queued notifications targeted at me (quiz invites, partner completes, etc.)
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("notify-queue-v2")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notification_queue", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as { id: string; kind: string; title: string; body: string; url?: string | null; data?: any };
          const key = `queue:${row.id}`;
          if (seen.current.has(key)) return;
          seen.current.add(key);
          push({
            id: key,
            title: row.title,
            body: row.body,
            createdAt: Date.now(),
            read: false,
            kind: row.kind,
            subjectId: row.data?.subject_id ?? null,
            topicId: row.data?.topic_id ?? null,
          });
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, push]);


  const markAllRead = useCallback(() => setNotifications((prev) => prev.map((n) => ({ ...n, read: true }))), []);
  const markRead = useCallback((id: string) => setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n))), []);
  const clearAll = useCallback(() => setNotifications([]), []);

  const sendTestPush = useCallback(async () => {
    if (!user) return;
    const { error } = await supabase.from("notification_queue").insert({
      user_id: user.id,
      kind: "test",
      title: "Test push 🔔",
      body: "If you see this with the tab closed, push is fully working.",
      url: "/dashboard",
    });
    if (error) toast.error(error.message);
    else toast.success("Test queued — should arrive within ~60s.");
  }, [user]);

  const unread = notifications.filter((n) => !n.read).length;

  const value = useMemo<Ctx>(() => ({
    notifications, unread, permission, pushEnabled,
    enablePush, disablePush, markAllRead, markRead, clearAll, sendTestPush,
  }), [notifications, unread, permission, pushEnabled, enablePush, disablePush, markAllRead, markRead, clearAll, sendTestPush]);

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
}
