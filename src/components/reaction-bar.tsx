import { useState } from "react";
import { REACTION_META, sendReaction, type ReactionKind } from "@/lib/partner";
import { toast } from "sonner";
import { celebrate } from "@/lib/celebrate";
import { fireHearts } from "@/components/floating-hearts";

export function ReactionBar({ toUserId, toName }: { toUserId?: string | null; toName?: string }) {
  const [busy, setBusy] = useState<ReactionKind | null>(null);
  const disabled = !toUserId;
  async function fire(kind: ReactionKind) {
    if (!toUserId) return;
    setBusy(kind);
    try {
      await sendReaction(toUserId, kind);
      celebrate();
      fireHearts(REACTION_META[kind].emoji);
      toast.success(`Sent ${REACTION_META[kind].emoji} to ${toName?.split(" ")[0] ?? "your partner"}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't send");
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="clay flex flex-wrap items-center gap-2 p-3">
      <span className="px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Send a lift
      </span>
      {(Object.keys(REACTION_META) as ReactionKind[]).map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => fire(k)}
          disabled={disabled || busy !== null}
          className="group inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-3 py-1.5 text-xs font-semibold transition hover:-translate-y-0.5 hover:bg-primary/10 hover:text-primary disabled:opacity-40"
        >
          <span className="text-base transition group-hover:scale-125">{REACTION_META[k].emoji}</span>
          {REACTION_META[k].label}
        </button>
      ))}
    </div>
  );
}
