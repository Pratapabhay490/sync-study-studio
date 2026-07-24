import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Sunrise, Moon } from "lucide-react";

type CheckinRow = {
  id?: string;
  date: string;
  morning_goal: string | null;
  planned_minutes: number | null;
  morning_at: string | null;
  night_status: string | null;
  night_note: string | null;
  night_at: string | null;
};

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function CheckinModal() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"morning" | "night" | null>(null);
  const [row, setRow] = useState<CheckinRow | null>(null);
  const [goal, setGoal] = useState("");
  const [minutes, setMinutes] = useState<string>("60");
  const [nightStatus, setNightStatus] = useState<"yes" | "partial" | "no">("yes");
  const [nightNote, setNightNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    let live = true;
    (async () => {
      const { data } = await supabase
        .from("daily_checkins")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", today())
        .maybeSingle();
      if (!live) return;
      const r = (data as any) ?? { date: today(), morning_goal: null, planned_minutes: null, morning_at: null, night_status: null, night_note: null, night_at: null };
      setRow(r);
      const hour = new Date().getHours();
      const dismissedKey = `sync:checkin-dismissed:${user.id}:${today()}`;
      const dismissed = typeof window !== "undefined" ? sessionStorage.getItem(dismissedKey) : null;
      if (dismissed) return;
      if (!r.morning_at && hour >= 4 && hour < 12) {
        setMode("morning");
        setOpen(true);
      } else if (r.morning_at && !r.night_at && hour >= 20) {
        setMode("night");
        setOpen(true);
      }
    })();
    return () => {
      live = false;
    };
  }, [user]);

  const dismiss = () => {
    setOpen(false);
    if (user) sessionStorage.setItem(`sync:checkin-dismissed:${user.id}:${today()}`, "1");
  };

  async function save() {
    if (!user) return;
    setSaving(true);
    const base = { user_id: user.id, date: today() };
    let payload: any = base;
    if (mode === "morning") {
      payload = {
        ...base,
        morning_goal: goal.trim() || null,
        planned_minutes: minutes ? Number(minutes) : null,
        morning_at: new Date().toISOString(),
      };
    } else if (mode === "night") {
      payload = {
        ...base,
        night_status: nightStatus,
        night_note: nightNote.trim() || null,
        night_at: new Date().toISOString(),
      };
    }
    const { error } = await supabase
      .from("daily_checkins")
      .upsert(payload, { onConflict: "user_id,date" });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(mode === "morning" ? "Goal locked in 🌱" : "Nice work today 🌙");
    supabase.functions.invoke("send-push", { body: {} }).catch(() => {});
    setOpen(false);
  }

  if (!row || !mode) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : dismiss())}>
      <DialogContent className="clay border-0 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl">
            {mode === "morning" ? <Sunrise className="h-5 w-5 text-amber-500" /> : <Moon className="h-5 w-5 text-indigo-400" />}
            {mode === "morning" ? "Morning check-in ☀️" : "Night check-in 🌙"}
          </DialogTitle>
          <DialogDescription>
            {mode === "morning"
              ? "Set one goal for today. Your partner will see a friendly summary."
              : "How did today go? A quick word, no pressure."}
          </DialogDescription>
        </DialogHeader>

        {mode === "morning" ? (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Today's goal</label>
              <Input
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="Finish Pharma chapter 4"
                className="mt-1"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Planned minutes</label>
              <Input
                value={minutes}
                onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                placeholder="60"
                className="mt-1"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Did you hit today's goal?</label>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(["yes", "partial", "no"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setNightStatus(v)}
                    className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                      nightStatus === v
                        ? "border-primary bg-primary/10 text-primary shadow-clay-sm"
                        : "border-border bg-card hover:-translate-y-0.5"
                    }`}
                  >
                    {v === "yes" ? "Yes ✅" : v === "partial" ? "Partly 🌱" : "Not today 🌙"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">A note for your partner (optional)</label>
              <Textarea
                value={nightNote}
                onChange={(e) => setNightNote(e.target.value)}
                placeholder="Long day — tomorrow we go again 💛"
                className="mt-1"
                rows={3}
              />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={dismiss}>Later</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : mode === "morning" ? "Lock it in" : "Save check-in"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
