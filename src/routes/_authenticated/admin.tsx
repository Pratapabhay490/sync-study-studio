import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { adminAnnounce, adminDeleteUser, adminUnlinkPartner, checkIsAdmin, getAdminOverview } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin panel · in sync" },
      { name: "description", content: "Manage users, view study stats and send announcements." },
      { property: "og:title", content: "Admin panel · in sync" },
      { property: "og:description", content: "Manage users, view study stats and send announcements." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const check = useServerFn(checkIsAdmin);
  const { data: role, isLoading } = useQuery({ queryKey: ["is-admin"], queryFn: () => check() });
  if (isLoading) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (!role?.isAdmin) return <div className="clay m-6 p-8 text-center"><h1 className="font-display text-xl font-bold">Admins only</h1><p className="mt-2 text-muted-foreground">This page isn't available for your account.</p></div>;
  return <AdminPanel />;
}

function AdminPanel() {
  const qc = useQueryClient();
  const overview = useServerFn(getAdminOverview);
  const unlink = useServerFn(adminUnlinkPartner);
  const del = useServerFn(adminDeleteUser);
  const announce = useServerFn(adminAnnounce);
  const { data, isLoading } = useQuery({ queryKey: ["admin-overview"], queryFn: () => overview() });
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-overview"] });

  async function run(fn: () => Promise<unknown>, ok: string) {
    try { await fn(); toast.success(ok); refresh(); } catch (e) { toast.error((e as Error).message); }
  }

  const t = data?.totals;
  const stats = t ? [
    ["Users", t.users], ["Active this week", t.activeWeek], ["Topics done", t.topics],
    ["Focus hours", Math.round(t.focusMinutes / 60)], ["Quiz answers", t.quizAnswers],
  ] : [];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <h1 className="font-display text-3xl font-bold">Admin panel</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {stats.map(([l, v]) => (
          <div key={l as string} className="clay p-4"><div className="text-xs text-muted-foreground">{l}</div><div className="font-display text-2xl font-bold">{v}</div></div>
        ))}
      </div>

      <section className="clay space-y-3 p-5">
        <h2 className="font-display text-lg font-bold">Send announcement</h2>
        <Input placeholder="Title" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} />
        <Textarea placeholder="Message to every user" value={body} maxLength={300} onChange={(e) => setBody(e.target.value)} />
        <Button disabled={sending} onClick={async () => {
          if (!confirm("Send this to every user?")) return;
          setSending(true);
          try { const r = await announce({ data: { title, body } }); toast.success(`Sent to ${r.sent} users`); setTitle(""); setBody(""); }
          catch (e) { toast.error((e as Error).message); } finally { setSending(false); }
        }}>{sending ? "Sending…" : "Send to everyone"}</Button>
      </section>

      <section className="clay overflow-x-auto p-5">
        <h2 className="mb-3 font-display text-lg font-bold">Users</h2>
        {isLoading ? <p className="text-muted-foreground">Loading…</p> : (
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground"><tr>
              <th className="p-2">User</th><th className="p-2">Joined</th><th className="p-2">Last active</th>
              <th className="p-2">Topics</th><th className="p-2">Focus min</th><th className="p-2">Quiz</th><th className="p-2">Partner</th><th className="p-2"></th>
            </tr></thead>
            <tbody>
              {data?.users.map((u) => (
                <tr key={u.id} className="border-t border-border">
                  <td className="p-2"><div className="font-semibold">{u.name || "—"}</div><div className="text-xs text-muted-foreground">{u.email}</div></td>
                  <td className="p-2">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="p-2">{u.lastActive ? new Date(u.lastActive).toLocaleString() : "—"}</td>
                  <td className="p-2">{u.topics}</td><td className="p-2">{u.focusMinutes}</td><td className="p-2">{u.quizAnswers}</td>
                  <td className="p-2">{u.partnerName ?? "—"}</td>
                  <td className="space-x-2 whitespace-nowrap p-2">
                    {u.partnerName && <Button size="sm" variant="outline" onClick={() => confirm(`Unlink ${u.email} from their partner?`) && run(() => unlink({ data: { userId: u.id } }), "Partner unlinked")}>Unlink</Button>}
                    <Button size="sm" variant="destructive" onClick={() => {
                      const c = prompt(`This permanently deletes ${u.email} and all their data. Type DELETE to confirm.`);
                      if (c) run(() => del({ data: { userId: u.id, confirmation: c } }), "User deleted");
                    }}>Delete</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
