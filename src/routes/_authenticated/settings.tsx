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
import { Download, LogOut, RotateCcw, UserX, Mail } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Let's be in sync" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, signOut } = useAuth();
  const { profiles, subjects, topics, progress, resetMyProgress } = useData();
  const { theme, toggle } = useTheme();
  const me = profiles.find((p) => p.id === user?.id);
  const [name, setName] = useState(me?.name ?? "");
  const [avatar, setAvatar] = useState(me?.avatar_url ?? "");

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
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your profile, theme, and data.</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
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

      <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <h3 className="mb-4 font-display text-lg font-semibold">Appearance</h3>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Dark mode</div>
            <div className="text-xs text-muted-foreground">Switch between premium dark and light themes</div>
          </div>
          <Switch checked={theme === "dark"} onCheckedChange={toggle} />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <h3 className="mb-4 font-display text-lg font-semibold">Data</h3>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={exportData}><Download className="mr-2 h-4 w-4" /> Export JSON</Button>
          <Button variant="outline" onClick={handleReset}><RotateCcw className="mr-2 h-4 w-4" /> Reset my progress</Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <h3 className="mb-4 font-display text-lg font-semibold">Account</h3>
        <Button variant="outline" onClick={signOut}><LogOut className="mr-2 h-4 w-4" /> Sign out</Button>
      </div>
    </div>
  );
}
