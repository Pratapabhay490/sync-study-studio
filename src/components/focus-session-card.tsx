import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { History, Play, Square, Timer, Users } from "lucide-react";

interface Props {
  session: any | null;
  partnerId?: string | null;
  partnerName?: string;
}

function fmtDuration(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function FocusSessionCard({ session, partnerId, partnerName }: Props) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [custom, setCustom] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<any[] | null>(null);

  // Clock-accurate tick: re-reads the wall clock each frame-ish, and realigns
  // to the next whole second so it never drifts behind the real time.
  useEffect(() => {
    if (!session) return;
    let timeout: ReturnType<typeof setTimeout>;
    const loop = () => {
      const t = Date.now();
      setNow(t);
      timeout = setTimeout(loop, 1000 - (t % 1000));
    };
    loop();
    const onVis = () => {
      if (document.visibilityState === "visible") setNow(Date.now());
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearTimeout(timeout);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [session?.id]);

  const remaining = useMemo(() => {
    if (!session) return 0;
    return Math.max(0, Math.round((new Date(session.ends_at).getTime() - now) / 1000));
  }, [session, now]);

  const hrs = Math.floor(remaining / 3600);
  const mins = Math.floor((remaining % 3600) / 60);
  const secs = remaining % 60;
  const total = session ? session.duration_min * 60 : 0;
  const pct = session ? Math.min(100, Math.max(0, ((total - remaining) / total) * 100)) : 0;

  const iAmParticipant =
    session && user && (session.host_id === user.id || session.partner_id === user.id);
  const iCanJoin =
    session &&
    user &&
    session.host_id !== user.id &&
    (!session.partner_id || session.partner_id === user.id);

  const loadHistory = useCallback(async () => {
    if (!user) return;
    const ids = [user.id, partnerId].filter(Boolean) as string[];
    const { data } = await supabase
      .from("focus_sessions")
      .select("*")
      .or(ids.map((id) => `host_id.eq.${id},partner_id.eq.${id}`).join(","))
      .order("started_at", { ascending: false })
      .limit(5);
    setHistory(data ?? []);
  }, [user, partnerId]);

  useEffect(() => {
    if (showHistory) loadHistory();
  }, [showHistory, loadHistory, session?.id]);

  async function start(duration: number) {
    if (!Number.isFinite(duration) || duration < 1 || duration > 480) {
      toast.error("Pick a duration between 1 and 480 minutes");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc("start_focus_session", {
      p_duration_min: Math.round(duration),
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      setCustom("");
      toast.success(
        partnerId
          ? `Focus session started · ${fmtDuration(Math.round(duration))} — partner notified ▶️`
          : `Focus session started · ${fmtDuration(Math.round(duration))} ▶️`,
      );
    }
    return data;
  }
  async function join() {
    if (!session) return;
    setBusy(true);
    const { error } = await supabase.rpc("join_focus_session", { p_session_id: session.id });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Joined the focus session 🎯");
  }
  async function end() {
    if (!session) return;
    setBusy(true);
    const { error } = await supabase.rpc("end_focus_session", { p_session_id: session.id });
    setBusy(false);
    if (error) toast.error(error.message);
  }

  const nameFor = (id: string | null) =>
    !id ? null : id === user?.id ? "You" : (partnerName?.split(" ")[0] ?? "Partner");

  return (
    <div className="clay group relative overflow-hidden p-6">
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gradient-primary opacity-15 blur-3xl" />
      <div className="relative flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-display text-lg font-bold">
            <Timer className="h-5 w-5 text-primary" />
            Study together
          </div>
          {session && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                session.state === "studying"
                  ? "bg-emerald-500/15 text-emerald-500"
                  : session.state === "break"
                    ? "bg-amber-500/15 text-amber-600"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  session.state === "studying" ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                }`}
              />
              {session.state === "studying" ? "Studying together" : session.state === "break" ? "Break" : "Ended"}
            </span>
          )}
        </div>

        {session ? (
          <>
            <div className="relative text-center">
              <motion.div
                aria-hidden="true"
                animate={{ scale: [1, 1.06, 1], opacity: [0.18, 0.3, 0.18] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-primary blur-2xl"
              />
              <motion.div
                key={secs}
                initial={{ scale: 0.97, opacity: 0.75 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 340, damping: 20 }}
                className="relative font-display text-6xl font-bold tracking-tight tabular-nums"
              >
                {hrs > 0 && `${hrs}:`}
                {hrs > 0 ? String(mins).padStart(2, "0") : mins}:{String(secs).padStart(2, "0")}
              </motion.div>
              <div className="relative mt-1 text-xs uppercase tracking-wider text-muted-foreground">
                {fmtDuration(session.duration_min)} session · started{" "}
                {new Date(session.started_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                · {session.joined_by_partner ? "both joined" : "waiting for partner"}
              </div>
              <div className="relative mt-2 flex justify-center gap-2 text-lg" aria-hidden="true">
                {["📚", "☕️", "🎯"].map((e, i) => (
                  <motion.span
                    key={e}
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.2 }}
                  >
                    {e}
                  </motion.span>
                ))}
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full bg-gradient-primary"
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {iCanJoin && (
                <button
                  type="button"
                  onClick={join}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-4 py-2 text-sm font-semibold text-white shadow-clay-sm"
                >
                  <Users className="h-4 w-4" /> Join session
                </button>
              )}
              {iAmParticipant && (
                <button
                  type="button"
                  onClick={end}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold"
                >
                  <Square className="h-4 w-4" /> End session
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Kick off a focus block and {partnerName?.split(" ")[0] ?? "your partner"} gets a push
              notification to join.
            </p>
            <div className="flex flex-wrap gap-2">
              {[25, 50, 90].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => start(d)}
                  disabled={busy || !partnerId}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-4 py-2 text-sm font-semibold text-white shadow-clay-sm transition hover:-translate-y-0.5 disabled:opacity-50"
                >
                  <Play className="h-4 w-4" /> {d} min
                </button>
              ))}
            </div>
            <form
              className="flex flex-wrap items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                start(Number(custom));
              }}
            >
              <input
                type="number"
                min={1}
                max={480}
                inputMode="numeric"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="Custom minutes"
                className="w-40 rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
              <button
                type="submit"
                disabled={busy || !partnerId || !custom}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5 disabled:opacity-50"
              >
                <Play className="h-4 w-4" /> Start
              </button>
              <span className="text-xs text-muted-foreground">1–480 min</span>
            </form>
            {!partnerId && (
              <p className="text-xs text-muted-foreground">
                Add a study partner in Settings to invite them to sessions.
              </p>
            )}
          </>
        )}

        <div className="border-t border-border/60 pt-3">
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
          >
            <History className="h-4 w-4" />
            {showHistory ? "Hide history" : "Recent focus sessions"}
          </button>
          {showHistory && (
            <div className="mt-3 flex flex-col gap-2">
              {history === null ? (
                <p className="text-xs text-muted-foreground">Loading…</p>
              ) : history.length === 0 ? (
                <p className="text-xs text-muted-foreground">No focus sessions yet.</p>
              ) : (
                history.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">{fmtDuration(h.duration_min)}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {new Date(h.started_at).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-xs text-muted-foreground">
                      <div>Started by {nameFor(h.host_id)}</div>
                      <div>
                        {h.joined_by_partner
                          ? `Joined by ${nameFor(h.partner_id) ?? "partner"}`
                          : "No one joined"}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
