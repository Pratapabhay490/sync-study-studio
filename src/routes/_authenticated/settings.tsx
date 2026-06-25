import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useData } from "@/lib/data-context";
import { useTheme } from "@/lib/theme-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { UserAvatar } from "@/components/user-avatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download, LogOut, RotateCcw, UserX, Mail, Bell, BellOff, Send, UserPlus, Loader2 } from "lucide-react";
import { useNotifications } from "@/lib/notifications-context";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import claySettings from "@/assets/clay-settings-mascot.png";
import clayPartners from "@/assets/clay-icon-partners.png";
import clayBell from "@/assets/clay-bell.png";
import clayProgress from "@/assets/clay-icon-progress.png";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Let's be in sync" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, signOut } = useAuth();
  const { profiles, subjects, topics, progress, resetMyProgress } = useData();
  const { pushEnabled, enablePush, disablePush, sendTestPush, permission } = useNotifications();
  const { theme, toggle } = useTheme();
  const me = profiles.find((p) => p.id === user?.id);
  const [name, setName] = useState(me?.name ?? "");
  const [avatar, setAvatar] = useState(me?.avatar_url ?? "");
  const [removePartner, setRemovePartner] = useState<{ id: string; name: string } | null>(null);
  const [partnerEmail, setPartnerEmail] = useState("");
  const [addingPartner, setAddingPartner] = useState(false);

  async function handleRemovePartner() {
    if (!removePartner) return;
    const { error } = await (supabase.rpc as any)("remove_study_partner", {
      p_partner_id: removePartner.id,
    });
    if (error) toast.error(error.message);
    else toast.success(`Removed ${removePartner.name} as a study partner`);
    setRemovePartner(null);
  }

  async function handleAddPartner() {
    const email = partnerEmail.trim();
    if (!email) return;
    setAddingPartner(true);
    const { error } = await (supabase.rpc as any)("add_study_partner_by_email", { p_email: email });
    setAddingPartner(false);
    if (error) {
      const msg = error.message?.includes("user_not_found")
        ? "No account found with that email. Ask them to sign up first."
        : error.message?.includes("cannot_partner_self")
        ? "You can't add yourself as a partner."
        : error.message;
      toast.error(msg);
      return;
    }
    toast.success(`Added ${email} as a study partner 🎉`);
    setPartnerEmail("");
  }

  async function saveProfile() {
    if (!user) return;
    const { error } = await supabase.from("profiles").update({ name, avatar_url: avatar || null }).eq("id", user.id);
    if (error) toast.error(error.message);
    else toast.success("Profile updated");
  }

  function exportData() {
    const payload = { profiles, subjects, topics, progress };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `in-sync-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleReset() {
    if (!confirm("Reset all your completion progress? This can't be undone.")) return;
    await resetMyProgress();
    toast.success("Your progress was reset");
  }

  return (
    <div className="space-y-6">
      {/* Hero header with mascot */}
      <div className="clay relative overflow-hidden rounded-3xl border-0 p-6 md:p-8">
        <div className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full bg-gradient-aurora opacity-30 blur-3xl" />
        <div className="relative flex items-center gap-5">
          <img
            src={claySettings}
            alt=""
            width={140}
            height={140}
            className="h-24 w-24 shrink-0 animate-float-slow drop-shadow-xl md:h-32 md:w-32"
          />
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">Settings</h1>
            <p className="mt-1 text-sm text-muted-foreground">Tune your profile, partners, notifications, and data.</p>
          </div>
        </div>
      </div>

      <div className="clay rounded-3xl border-0 p-6">
        <h3 className="mb-4 font-display text-lg font-semibold">Profile</h3>
        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          <UserAvatar profile={{ ...me!, name, avatar_url: avatar || null }} size={64} ring />
          <div className="grid flex-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="name">Display name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="avatar">Avatar URL</Label>
              <Input id="avatar" value={avatar} onChange={(e) => setAvatar(e.target.value)} placeholder="https://…" />
            </div>
          </div>
          <Button onClick={saveProfile} className="bg-gradient-primary text-white">Save</Button>
        </div>
      </div>

      <div className="clay rounded-3xl border-0 p-6">
        <div className="mb-4 flex items-start gap-3">
          <img src={clayPartners} alt="" width={56} height={56} className="h-12 w-12 shrink-0 drop-shadow-md" />
          <div>
            <h3 className="font-display text-lg font-semibold">Study partners</h3>
            <p className="text-xs text-muted-foreground">Add a partner by their account email to share progress and analytics.</p>
          </div>
        </div>

        <div className="mb-5 flex flex-col gap-2 sm:flex-row">
          <Input
            type="email"
            value={partnerEmail}
            onChange={(e) => setPartnerEmail(e.target.value)}
            placeholder="partner@example.com"
            onKeyDown={(e) => e.key === "Enter" && handleAddPartner()}
          />
          <Button onClick={handleAddPartner} disabled={addingPartner || !partnerEmail.trim()} className="bg-gradient-primary text-white">
            {addingPartner ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
            Add partner
          </Button>
        </div>

        <ul className="space-y-3">
          {profiles.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-xl border border-border bg-background/50 p-3">
              <UserAvatar profile={p} size={44} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display font-semibold">{p.name}</span>
                  {p.id === user?.id && (
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">You</span>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Mail className="h-3 w-3" />
                  <span className="truncate">{p.email}</span>
                </div>
              </div>
              {p.id !== user?.id && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRemovePartner({ id: p.id, name: p.name })}
                  className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                >
                  <UserX className="mr-1 h-4 w-4" /> Remove
                </Button>
              )}
            </li>
          ))}
          {profiles.length <= 1 && (
            <li className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              No study partner yet. Share the sign-up link with them.
            </li>
          )}
        </ul>
      </div>

      <div className="clay rounded-3xl border-0 p-6">
        <div className="mb-4 flex items-start gap-3">
          <img src={clayBell} alt="" width={56} height={56} className="h-12 w-12 shrink-0 animate-float-slow drop-shadow-md" />
          <div>
            <h3 className="font-display text-lg font-semibold">Push notifications</h3>
            <p className="text-xs text-muted-foreground">
              Get notified when your partner finishes a topic, when they poke you, and 5 daily motivational nudges — even when this tab is closed.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {pushEnabled ? (
            <>
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-600">
                <Bell className="h-3.5 w-3.5" /> Push enabled on this device
              </span>
              <Button variant="outline" size="sm" onClick={sendTestPush}>
                <Send className="mr-2 h-3.5 w-3.5" /> Send me a test
              </Button>
              <Button variant="outline" size="sm" onClick={disablePush}>
                <BellOff className="mr-2 h-3.5 w-3.5" /> Turn off
              </Button>
            </>
          ) : (
            <>
              <Button onClick={enablePush} className="bg-gradient-primary text-white">
                <Bell className="mr-2 h-4 w-4" /> Enable push on this device
              </Button>
              {permission === "denied" && (
                <span className="text-xs text-destructive">Blocked in browser settings — unblock for this site to enable.</span>
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="clay rounded-3xl border-0 p-6">
          <h3 className="mb-4 font-display text-lg font-semibold">Appearance</h3>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Dark mode</div>
              <div className="text-xs text-muted-foreground">Switch between premium dark and light themes</div>
            </div>
            <Switch checked={theme === "dark"} onCheckedChange={toggle} />
          </div>
        </div>

        <div className="clay rounded-3xl border-0 p-6">
          <div className="mb-4 flex items-start gap-3">
            <img src={clayProgress} alt="" width={48} height={48} className="h-10 w-10 shrink-0 drop-shadow-md" />
            <h3 className="font-display text-lg font-semibold">Your data</h3>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={exportData}><Download className="mr-2 h-4 w-4" /> Export JSON</Button>
            <Button variant="outline" onClick={handleReset}><RotateCcw className="mr-2 h-4 w-4" /> Reset my progress</Button>
          </div>
        </div>
      </div>

      <div className="clay rounded-3xl border-0 p-6">
        <h3 className="mb-4 font-display text-lg font-semibold">Account</h3>
        <Button variant="outline" onClick={signOut}><LogOut className="mr-2 h-4 w-4" /> Sign out</Button>
      </div>

      <AlertDialog open={!!removePartner} onOpenChange={(o) => !o && setRemovePartner(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removePartner?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes their profile and progress from the shared study space. Their login account still exists — they can sign in again to rejoin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemovePartner} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove partner
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
