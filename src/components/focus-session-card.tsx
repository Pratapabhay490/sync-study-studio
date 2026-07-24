import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Play, Square, Timer, Users } from "lucide-react";

interface Props {
  session: any | null;
  partnerId?: string | null;
  partnerName?: string;
}

export function FocusSessionCard({ session, partnerId, partnerName }: Props) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!session) return;
    const iv = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(iv);
  }, [session]);

  const remaining = useMemo(() => {
    if (!session) return 0;
    return Math.max(0, Math.floor((new Date(session.ends_at).getTime() - Date.now()) / 1000));
  }, [session, tick]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const pct = session
    ? Math.min(
        100,
        Math.max(
          0,
          ((session.duration_min * 60 - remaining) / (session.duration_min * 60)) * 100,
        ),
      )
    : 0;

  const iAmParticipant =
    session && user && (session.host_id === user.id || session.partner_id === user.id);
  const iCanJoin =
    session &&
    user &&
    session.host_id !== user.id &&
    (!session.partner_id || session.partner_id === user.id);

  async function start(duration: number) {
    setBusy(true);
    const { data, error } = await supabase.rpc("start_focus_session", { p_duration_min: duration });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success(`Focus session started · ${duration} min ▶️`);
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
            <div className="text-center">
              <div className="font-display text-6xl font-bold tracking-tight tabular-nums">
                {mins}:{String(secs).padStart(2, "0")}
              </div>
              <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
                {session.duration_min} min session · {session.joined_by_partner ? "both joined" : "waiting for partner"}
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-gradient-primary transition-all" style={{ width: `${pct}%` }} />
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
              Kick off a focus block and {partnerName?.split(" ")[0] ?? "your partner"} will get a nudge to join.
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
            {!partnerId && (
              <p className="text-xs text-muted-foreground">
                Add a study partner in Settings to invite them to sessions.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
