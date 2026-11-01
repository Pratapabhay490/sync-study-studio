import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Trash2, Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { restartFresh, deleteOwnAccount } from "@/lib/account.functions";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import type { AccountAction } from "@/lib/account-actions";

export function AccountDataActions() {
  const { isGuest, user } = useAuth();
  const queryClient = useQueryClient();
  const reset = useServerFn(restartFresh);
  const remove = useServerFn(deleteOwnAccount);
  const [action, setAction] = useState<AccountAction | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const deleting = action === "delete";
  const expected = deleting ? "DELETE" : "RESET";

  function open(next: AccountAction) {
    setConfirmation(""); setError(""); setAction(next);
  }
  async function confirmAction() {
    if (busy || confirmation !== expected || !action) return;
    setBusy(true); setError("");
    try {
      if (action === "reset") {
        await reset({ data: { confirmation } });
        queryClient.clear();
        toast.success("Fresh start complete. Your subjects and topics are unchanged.");
        window.location.reload();
      } else {
        await remove({ data: { confirmation } });
        await supabase.auth.signOut({ scope: "local" });
        queryClient.clear();
        window.location.assign("/auth");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't complete this action. Please try again.");
      setBusy(false);
    }
  }
  if (isGuest || !user) return null;
  return (
    <section className="space-y-5 border-t border-border pt-5" aria-labelledby="account-data-title">
      <h4 id="account-data-title" className="font-display font-semibold">Fresh start &amp; account deletion</h4>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <p className="text-sm font-medium">Restart fresh</p>
          <p className="mt-1 text-xs text-muted-foreground">Clear your study progress. Keep your edited subjects and topics.</p>
        </div>
        <Button variant="outline" className="shrink-0" onClick={() => open("reset")}><RotateCcw className="mr-2 h-4 w-4" />Restart fresh</Button>
      </div>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <p className="text-sm font-medium text-destructive">Delete account permanently</p>
          <p className="mt-1 text-xs text-muted-foreground">Remove your account and personal data. This cannot be undone.</p>
        </div>
        <Button variant="destructive" className="shrink-0" onClick={() => open("delete")}><Trash2 className="mr-2 h-4 w-4" />Delete account</Button>
      </div>
      <AlertDialog open={action !== null} onOpenChange={(value) => { if (!value && !busy) setAction(null); }}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <TriangleAlert className="h-6 w-6 text-destructive" aria-hidden="true" />
            <AlertDialogTitle>{deleting ? "Permanently delete your account?" : "Restart your study progress?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting
                ? "Warning: your login, profile, personal study data, uploaded study notes, XP and badges will be permanently removed. You will be signed out and cannot recover this account. Your partner's account, syllabus and individual progress will remain; your partnership and together records will end."
                : "Warning: your topic completions, revision stars, daily tasks, check-ins, quiz history, focus history, weekly goal progress, XP and badges will be erased. Your existing subjects, topics, names and edits, profile, study notes and bookmarks will stay. Your partner's individual progress will stay, but your together streak and challenge progress will restart. This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <p className="text-xs text-muted-foreground">Export your data first if you want a copy.</p>
          <div className="space-y-2">
            <Label htmlFor="account-confirmation">Type {expected} to confirm</Label>
            <Input id="account-confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" disabled={busy} />
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <Button variant="destructive" disabled={busy || confirmation !== expected} onClick={confirmAction}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {busy ? "Please wait…" : deleting ? "Permanently delete account" : "Erase progress & restart"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}