import { useState } from "react";
import { Hand, Send } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

const QUICK = [
  "Open a topic, just one 📖",
  "Streak alert! Don't break it 🔥",
  "Pomodoro with me? ⏱️",
  "Five topics today, deal? 🤝",
  "Stop scrolling, start studying 😜",
];

export function PokeButton({ toUserId, toName, compact = false }: { toUserId?: string | null; toName?: string; compact?: boolean }) {
  const { user } = useAuth();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const disabled = !user || !toUserId;

  const send = async (text?: string) => {
    if (!user || !toUserId) return;
    const message = (text ?? msg).trim() || "Let's study! 📚";
    setBusy(true);
    const { error } = await supabase.from("pokes").insert({
      from_user: user.id,
      to_user: toUserId,
      message,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success(`Poked ${toName?.split(" ")[0] ?? "your partner"}! 👋`);
      setMsg("");
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={`group relative inline-flex items-center gap-2 rounded-2xl bg-gradient-aurora px-4 py-2.5 text-sm font-semibold text-white shadow-clay-sm transition active:scale-95 hover:-translate-y-0.5 hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-50 ${compact ? "px-3 py-2 text-xs" : ""}`}
        >
          <Hand className="h-4 w-4 transition group-hover:rotate-12" />
          Poke {toName ? toName.split(" ")[0] : ""}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="clay w-80 border-0 p-3">
        <div className="font-display text-sm font-bold">Send a nudge 👋</div>
        <div className="mt-1 text-[11px] text-muted-foreground">
          {toName ? `${toName.split(" ")[0]} gets a push notification — even if their tab is closed.` : "They'll get a push notification."}
        </div>
        <div className="mt-3 grid gap-1">
          {QUICK.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => send(q)}
              disabled={busy || disabled}
              className="rounded-xl bg-muted/60 px-3 py-2 text-left text-xs font-medium transition hover:-translate-y-0.5 hover:bg-primary/10 hover:text-primary"
            >
              {q}
            </button>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <Input
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            placeholder="Custom message…"
            className="h-9 text-xs"
            onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          />
          <Button size="sm" onClick={() => send()} disabled={busy || disabled} className="h-9">
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
