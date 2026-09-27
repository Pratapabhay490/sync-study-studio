import { useState } from "react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSoloMode } from "@/lib/solo-mode";

/** Solo mode switch that always asks for confirmation before changing. */
export function SoloModeToggle({ className = "" }: { className?: string }) {
  const { solo, setSolo } = useSoloMode();
  const [pending, setPending] = useState<boolean | null>(null);

  async function confirm() {
    if (pending === null) return;
    const next = pending;
    setPending(null);
    const { error } = await setSolo(next);
    if (error) toast.error("Couldn't update solo mode");
    else toast.success(next ? "Solo mode on" : "Solo mode off — you can invite a partner again");
  }

  return (
    <>
      <div className={`flex items-center justify-between gap-4 rounded-2xl border border-border bg-background/50 p-4 ${className}`}>
        <div className="min-w-0">
          <Label htmlFor="solo-mode" className="font-display text-sm font-semibold">Solo mode</Label>
          <p className="text-xs text-muted-foreground">
            Study on your own without partner prompts. Turn it off anytime to add a partner.
          </p>
        </div>
        <Switch id="solo-mode" checked={solo} onCheckedChange={(v) => setPending(v)} />
      </div>

      <AlertDialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pending ? "Turn on solo mode?" : "Turn off solo mode?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {pending
                ? "Partner prompts will be hidden and you won't be able to send or accept partner invites until you turn it off. Your progress stays exactly as it is."
                : "Partner prompts will come back and you'll be able to send and accept partner invites. Your progress stays exactly as it is."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep as is</AlertDialogCancel>
            <AlertDialogAction onClick={confirm}>{pending ? "Turn on" : "Turn off"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
