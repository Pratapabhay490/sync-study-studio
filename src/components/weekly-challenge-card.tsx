import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Target, Gift } from "lucide-react";
import { toast } from "sonner";
import { celebrate } from "@/lib/celebrate";

interface Challenge {
  id: string;
  title: string;
  description: string;
  goal: number;
  progress: number;
  reward_xp: number;
  claimed: boolean;
}

export function WeeklyChallengeCard({ partnerId }: { partnerId?: string | null }) {
  const [ch, setCh] = useState<Challenge | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!partnerId) return;
    let live = true;
    const ensure = async () => {
      const { data: id, error } = await supabase.rpc("ensure_weekly_challenge");
      if (error || !id) return;
      const { data } = await supabase
        .from("weekly_challenges")
        .select("*")
        .eq("id", id)
        .single();
      if (live && data) setCh(data as Challenge);
    };
    ensure();
    const sub = supabase
      .channel("weekly-ch")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "weekly_challenges" },
        () => ensure(),
      )
      .subscribe();
    return () => {
      live = false;
      supabase.removeChannel(sub);
    };
  }, [partnerId]);

  if (!partnerId) return null;
  if (!ch) return null;

  const pct = Math.min(100, Math.round((ch.progress / ch.goal) * 100));
  const done = ch.progress >= ch.goal;

  async function claim() {
    if (!ch) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("claim_weekly_challenge", { p_id: ch.id });
    setBusy(false);
    if (error) toast.error(error.message);
    else if (data) {
      celebrate();
      toast.success(`Claimed +${ch.reward_xp} XP each 🎁`);
    }
  }

  return (
    <div className="clay relative overflow-hidden p-6">
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gradient-primary opacity-15 blur-3xl" />
      <div className="relative">
        <div className="mb-3 flex items-center justify-between gap-4">
          <div className="inline-flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <h2 className="font-display text-lg font-bold">This week's challenge</h2>
          </div>
          <div className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
            <Gift className="h-3 w-3" /> +{ch.reward_xp} XP each
          </div>
        </div>
        <div className="text-sm font-semibold">{ch.title}</div>
        <p className="mb-3 text-xs text-muted-foreground">{ch.description}</p>
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="tabular-nums font-bold">{ch.progress}/{ch.goal}</span>
          <span className="text-muted-foreground">{pct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-gradient-primary transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>
        {done && !ch.claimed && (
          <button
            type="button"
            onClick={claim}
            disabled={busy}
            className="mt-4 w-full rounded-2xl bg-gradient-primary py-2.5 text-sm font-bold text-white shadow-clay-sm transition hover:-translate-y-0.5"
          >
            Claim reward 🎁
          </button>
        )}
        {ch.claimed && (
          <div className="mt-4 rounded-2xl bg-emerald-500/10 py-2 text-center text-xs font-bold text-emerald-500">
            Claimed — nice teamwork ✨
          </div>
        )}
      </div>
    </div>
  );
}
