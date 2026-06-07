import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useData } from "@/lib/data-context";
import { getSubjectIcon } from "@/lib/subject-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { formatDistanceToNow, parseISO } from "date-fns";
import { ProgressRing } from "@/components/progress-ring";

export const Route = createFileRoute("/_authenticated/subjects/$id")({
  head: () => ({ meta: [{ title: "Subject — Let's be in sync" }] }),
  component: SubjectDetail,
});

function SubjectDetail() {
  const { id } = useParams({ from: "/_authenticated/subjects/$id" });
  const { user } = useAuth();
  const { subjects, topics, progress, profiles, addTopic, bulkAddTopics, updateTopic, deleteTopic, toggleTopic } = useData();

  const subject = subjects.find((s) => s.id === id);
  const sTopics = useMemo(() => topics.filter((t) => t.subject_id === id), [topics, id]);

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "completed" | "pending">("all");
  const [openAdd, setOpenAdd] = useState(false);
  const [openBulk, setOpenBulk] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [editTopic, setEditTopic] = useState<null | { id: string; name: string; description: string }>(null);
  const [confirmDelete, setConfirmDelete] = useState<null | { id: string; name: string }>(null);

  const Icon = getSubjectIcon(subject?.icon);

  const isCompletedByMe = (topicId: string) =>
    !!user && progress.some((p) => p.topic_id === topicId && p.user_id === user.id && p.completed);

  const visible = sTopics
    .filter((t) => t.topic_name.toLowerCase().includes(q.toLowerCase()))
    .filter((t) => {
      const anyDone = progress.some((p) => p.topic_id === t.id && p.completed);
      if (filter === "completed") return anyDone;
      if (filter === "pending") return !anyDone;
      return true;
    });

  const stats = profiles.map((p) => {
    const done = progress.filter((pr) => pr.user_id === p.id && pr.completed && sTopics.some((t) => t.id === pr.topic_id)).length;
    return { profile: p, done, pct: sTopics.length ? Math.round((done / sTopics.length) * 100) : 0 };
  });

  async function handleAddTopic() {
    if (!newName.trim()) return;
    await addTopic(id, newName.trim(), newDesc.trim() || undefined);
    toast.success("Topic added");
    setNewName("");
    setNewDesc("");
    setOpenAdd(false);
  }

  async function handleBulk() {
    const names = bulkText.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!names.length) return;
    await bulkAddTopics(id, names);
    toast.success(`Added ${names.length} topics`);
    setBulkText("");
    setOpenBulk(false);
  }

  if (!subject) {
    return (
      <div className="space-y-4">
        <Link to="/subjects" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <p>Subject not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to="/subjects" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All subjects
      </Link>

      <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-card md:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-gradient-aurora opacity-20 blur-3xl" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-primary text-white shadow-glow">
              <Icon className="h-8 w-8" />
            </div>
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">{subject.name}</h1>
              <p className="text-sm text-muted-foreground">{sTopics.length} topics</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {stats.map((s, i) => (
              <ProgressRing
                key={s.profile.id}
                value={s.pct}
                size={84}
                stroke={8}
                gradientId={`sdr-${i}`}
                gradientFrom={i === 0 ? "oklch(0.62 0.2 250)" : "oklch(0.68 0.2 340)"}
                gradientTo={i === 0 ? "oklch(0.55 0.22 275)" : "oklch(0.6 0.22 305)"}
              >
                <div className="text-center">
                  <div className="font-display text-base font-bold">{s.pct}%</div>
                  <div className="text-[9px] uppercase text-muted-foreground">{s.profile.name.split(" ")[0]}</div>
                </div>
              </ProgressRing>
            ))}
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative md:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search topics" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as never)}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="completed">Done</TabsTrigger>
            </TabsList>
          </Tabs>
          <Dialog open={openBulk} onOpenChange={setOpenBulk}>
            <DialogTrigger asChild>
              <Button variant="outline"><Upload className="mr-1 h-4 w-4" /> Bulk add</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Bulk add topics</DialogTitle></DialogHeader>
              <p className="text-xs text-muted-foreground">One topic per line.</p>
              <Textarea rows={8} value={bulkText} onChange={(e) => setBulkText(e.target.value)} placeholder={"Topic 1\nTopic 2\nTopic 3"} />
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpenBulk(false)}>Cancel</Button>
                <Button onClick={handleBulk} className="bg-gradient-primary text-white">Add all</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={openAdd} onOpenChange={setOpenAdd}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary text-white shadow-glow"><Plus className="mr-1 h-4 w-4" /> Add topic</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New topic</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="tn">Topic name</Label>
                  <Input id="tn" value={newName} onChange={(e) => setNewName(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="td">Description (optional)</Label>
                  <Textarea id="td" rows={3} value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpenAdd(false)}>Cancel</Button>
                <Button onClick={handleAddTopic} className="bg-gradient-primary text-white">Add</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        {visible.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">No topics match your filter.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-background/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Topic</th>
                <th className="hidden px-4 py-3 text-left md:table-cell">Added</th>
                {profiles.map((p) => (
                  <th key={p.id} className="px-4 py-3 text-center">{p.name.split(" ")[0]}</th>
                ))}
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {visible.map((t) => (
                <tr key={t.id} className="border-b border-border/50 transition hover:bg-accent/20">
                  <td className="px-4 py-3">
                    <div className="font-medium">{t.topic_name}</div>
                    {t.description && <div className="text-xs text-muted-foreground">{t.description}</div>}
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-muted-foreground md:table-cell">
                    {formatDistanceToNow(parseISO(t.created_at), { addSuffix: true })}
                  </td>
                  {profiles.map((p) => {
                    const pr = progress.find((x) => x.topic_id === t.id && x.user_id === p.id);
                    const isMe = p.id === user?.id;
                    return (
                      <td key={p.id} className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <Checkbox
                            checked={pr?.completed ?? false}
                            disabled={!isMe}
                            onCheckedChange={(v) => isMe && toggleTopic(t.id, !!v)}
                          />
                          {pr?.completed && pr.completed_at && (
                            <span className="text-[10px] text-muted-foreground">
                              {formatDistanceToNow(parseISO(pr.completed_at), { addSuffix: true })}
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-2 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Edit topic"
                        onClick={() => setEditTopic({ id: t.id, name: t.topic_name, description: t.description ?? "" })}
                      >
                        <Pencil className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Delete topic"
                        onClick={() => setConfirmDelete({ id: t.id, name: t.topic_name })}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* completion stats indicator for filter consistency */}
      <div className="text-xs text-muted-foreground">
        Showing {visible.length} of {sTopics.length} topics
        {filter !== "all" && (isCompletedByMe(visible[0]?.id ?? "") || true) ? "" : ""}
      </div>
    </div>
  );
}
