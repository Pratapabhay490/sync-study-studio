import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useData } from "@/lib/data-context";
import { getSubjectIcon } from "@/lib/subject-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Check, Pencil, Plus, Search, Trash2, Upload, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { formatDistanceToNow, parseISO } from "date-fns";
import { ProgressRing } from "@/components/progress-ring";
import { cn } from "@/lib/utils";
import { celebrate } from "@/lib/celebrate";
import { ClayLoader, ClayVisual } from "@/components/clay-visuals";

export const Route = createFileRoute("/_authenticated/subjects/$id")({
  head: () => ({ meta: [{ title: "Subject — Let's be in sync" }] }),
  component: SubjectDetail,
});

function SubjectDetail() {
  const { id } = useParams({ from: "/_authenticated/subjects/$id" });
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    loading,
    subjects,
    topics,
    progress,
    profiles,
    addTopic,
    bulkAddTopics,
    updateTopic,
    deleteTopic,
    toggleTopic,
    updateSubject,
    deleteSubject,
  } = useData();

  const subject = subjects.find((s) => s.id === id);
  const sTopics = useMemo(() => topics.filter((t) => t.subject_id === id), [topics, id]);

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "completed" | "pending">("all");
  const [editMode, setEditMode] = useState(false);
  const [openAdd, setOpenAdd] = useState(false);
  const [openBulk, setOpenBulk] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [editTopic, setEditTopic] = useState<null | {
    id: string;
    name: string;
    description: string;
  }>(null);
  const [confirmDelete, setConfirmDelete] = useState<null | { id: string; name: string }>(null);
  const [subjectRename, setSubjectRename] = useState("");
  const [subjectDeleteOpen, setSubjectDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const Icon = getSubjectIcon(subject?.icon);

  const visible = sTopics
    .filter((t) => t.topic_name.toLowerCase().includes(q.toLowerCase()))
    .filter((t) => {
      const anyDone = progress.some((p) => p.topic_id === t.id && p.completed);
      if (filter === "completed") return anyDone;
      if (filter === "pending") return !anyDone;
      return true;
    });

  const stats = profiles.map((p) => {
    const done = progress.filter(
      (pr) => pr.user_id === p.id && pr.completed && sTopics.some((t) => t.id === pr.topic_id),
    ).length;
    return {
      profile: p,
      done,
      pct: sTopics.length ? Math.round((done / sTopics.length) * 100) : 0,
    };
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
    const names = bulkText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (!names.length) return;
    await bulkAddTopics(id, names);
    toast.success(`Added ${names.length} topics`);
    setBulkText("");
    setOpenBulk(false);
  }

  async function handleSubjectRename() {
    if (!subject || !subjectRename.trim()) return;
    setBusy(true);
    const res = await updateSubject(subject.id, { name: subjectRename.trim() });
    setBusy(false);
    if (res.error) {
      toast.error(`Couldn't rename: ${res.error}`);
      return;
    }
    toast.success("Subject renamed");
    setSubjectRename("");
  }

  async function handleSubjectDelete() {
    if (!subject) return;
    const res = await deleteSubject(subject.id);
    if (res.error) {
      toast.error(`Couldn't delete: ${res.error}`);
      return;
    }
    toast.success("Subject deleted");
    setSubjectDeleteOpen(false);
    navigate({ to: "/subjects" });
  }

  if (loading) return <ClayLoader label="Opening topic list" />;

  if (!subject) {
    return (
      <div className="space-y-4">
        <Link
          to="/subjects"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <p>Subject not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        to="/subjects"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> All subjects
      </Link>

      <section className="clay relative overflow-hidden p-6 md:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-gradient-aurora opacity-30 blur-3xl" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-3xl bg-gradient-primary text-white shadow-clay-sm">
              <Icon className="h-8 w-8" />
            </div>
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
                {subject.name}
              </h1>
              <p className="text-sm text-muted-foreground">{sTopics.length} topics</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 md:justify-end">
            <Button
              variant="outline"
              onClick={() => setSubjectRename(subject.name)}
              className="shadow-clay-sm"
            >
              <Pencil className="h-4 w-4" /> Rename subject
            </Button>
            <Button
              variant="destructive"
              onClick={() => setSubjectDeleteOpen(true)}
              className="shadow-clay-sm"
            >
              <Trash2 className="h-4 w-4" /> Delete subject
            </Button>
            {stats.map((s, i) => (
              <ProgressRing
                key={s.profile.id}
                value={s.pct}
                size={84}
                stroke={8}
                gradientId={`sdr-${i}`}
                gradientFrom={i === 0 ? "oklch(0.74 0.16 235)" : "oklch(0.78 0.15 350)"}
                gradientTo={i === 0 ? "oklch(0.74 0.16 305)" : "oklch(0.78 0.16 320)"}
              >
                <div className="text-center">
                  <div className="font-display text-base font-bold">{s.pct}%</div>
                  <div className="text-[9px] uppercase text-muted-foreground">
                    {s.profile.name.split(" ")[0]}
                  </div>
                </div>
              </ProgressRing>
            ))}
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative md:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="clay-pressed border-0 pl-9"
            placeholder="Search topics"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as never)}>
          <TabsList className="clay-pressed">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="completed">Done</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Topic list card with Edit toggle at top right */}
      <div className="clay overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-4">
          <div>
            <h2 className="font-display text-lg font-semibold">Topics</h2>
            <p className="text-xs text-muted-foreground">
              {editMode
                ? "Edit mode — add, rename or remove topics"
                : "Tap the circle to mark a topic complete"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {editMode && (
              <>
                <Dialog open={openBulk} onOpenChange={setOpenBulk}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="rounded-full shadow-clay-sm border-0">
                      <Upload className="mr-1 h-4 w-4" /> Bulk add
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="clay border-0">
                    <DialogHeader>
                      <DialogTitle>Bulk add topics</DialogTitle>
                    </DialogHeader>
                    <p className="text-xs text-muted-foreground">One topic per line.</p>
                    <Textarea
                      rows={8}
                      value={bulkText}
                      onChange={(e) => setBulkText(e.target.value)}
                      placeholder={"Topic 1\nTopic 2\nTopic 3"}
                    />
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setOpenBulk(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleBulk} className="bg-gradient-primary text-white">
                        Add all
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Dialog open={openAdd} onOpenChange={setOpenAdd}>
                  <DialogTrigger asChild>
                    <Button className="rounded-full bg-gradient-primary text-white shadow-clay-sm">
                      <Plus className="mr-1 h-4 w-4" /> Add topic
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="clay border-0">
                    <DialogHeader>
                      <DialogTitle>New topic</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="tn">Topic name</Label>
                        <Input
                          id="tn"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="td">Description (optional)</Label>
                        <Textarea
                          id="td"
                          rows={3}
                          value={newDesc}
                          onChange={(e) => setNewDesc(e.target.value)}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setOpenAdd(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleAddTopic} className="bg-gradient-primary text-white">
                        Add
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </>
            )}
            <Button
              onClick={() => setEditMode((v) => !v)}
              className={cn(
                "rounded-full border-0 shadow-clay-sm",
                editMode ? "bg-foreground text-background" : "bg-gradient-primary text-white",
              )}
            >
              {editMode ? (
                <>
                  <X className="mr-1 h-4 w-4" /> Done
                </>
              ) : (
                <>
                  <Pencil className="mr-1 h-4 w-4" /> Edit
                </>
              )}
            </Button>
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="grid gap-4 p-8 text-center text-sm text-muted-foreground md:grid-cols-[1fr_220px] md:items-center md:text-left">
            <div>
              <div className="font-display text-xl font-bold text-foreground">
                {editMode ? "Ready for your first topic" : "No topics match this view"}
              </div>
              <p className="mt-1">
                {editMode
                  ? "Use Add topic or Bulk add from the top-right controls."
                  : "Try another filter or search term."}
              </p>
            </div>
            <ClayVisual variant="icons" className="mx-auto w-44" />
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {visible.map((t) => {
              const myProgress = progress.find(
                (p) => p.topic_id === t.id && p.user_id === user?.id,
              );
              const myDone = !!myProgress?.completed;
              return (
                <li
                  key={t.id}
                  className="group flex items-center gap-4 px-5 py-4 transition hover:bg-accent/20"
                >
                  {/* Big clay tick in front */}
                  <button
                    type="button"
                    onClick={(e) => {
                      const next = !myDone;
                      toggleTopic(t.id, next);
                      if (next) {
                        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        celebrate(
                          (r.left + r.width / 2) / window.innerWidth,
                          (r.top + r.height / 2) / window.innerHeight,
                        );
                      }
                    }}
                    aria-label={myDone ? "Mark as pending" : "Mark as complete"}
                    className={cn(
                      "grid h-10 w-10 shrink-0 place-items-center rounded-2xl transition-all active:scale-95",
                      myDone
                        ? "bg-gradient-primary text-white shadow-clay-sm"
                        : "shadow-clay-inset bg-muted text-transparent hover:text-muted-foreground",
                    )}
                  >
                    <Check
                      className={cn("h-5 w-5 transition", myDone ? "opacity-100" : "opacity-40")}
                      strokeWidth={3}
                    />
                  </button>

                  <div className="min-w-0 flex-1">
                    <div
                      className={cn(
                        "truncate font-medium",
                        myDone && "text-muted-foreground line-through",
                      )}
                    >
                      {t.topic_name}
                    </div>
                    {t.description && (
                      <div className="truncate text-xs text-muted-foreground">{t.description}</div>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      {profiles.map((p) => {
                        const pr = progress.find((x) => x.topic_id === t.id && x.user_id === p.id);
                        const done = !!pr?.completed;
                        return (
                          <span
                            key={p.id}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 shadow-clay-sm",
                              done
                                ? "bg-success/20 text-success-foreground"
                                : "bg-muted text-muted-foreground",
                            )}
                          >
                            <span
                              className={cn(
                                "h-1.5 w-1.5 rounded-full",
                                done ? "bg-success" : "bg-muted-foreground/40",
                              )}
                            />
                            {p.name.split(" ")[0]}
                            {done && pr?.completed_at && (
                              <span className="opacity-70">
                                ·{" "}
                                {formatDistanceToNow(parseISO(pr.completed_at), {
                                  addSuffix: true,
                                })}
                              </span>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {editMode && (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Rename topic"
                        className="rounded-full shadow-clay-sm"
                        onClick={() =>
                          setEditTopic({
                            id: t.id,
                            name: t.topic_name,
                            description: t.description ?? "",
                          })
                        }
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Delete topic"
                        className="rounded-full text-destructive shadow-clay-sm"
                        onClick={() => setConfirmDelete({ id: t.id, name: t.topic_name })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="text-xs text-muted-foreground">
        Showing {visible.length} of {sTopics.length} topics
      </div>

      <Dialog open={!!subjectRename} onOpenChange={(o) => !o && setSubjectRename("")}>
        <DialogContent className="clay border-0">
          <DialogHeader>
            <DialogTitle>Rename subject</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="subject-name">Subject name</Label>
            <Input
              id="subject-name"
              autoFocus
              value={subjectRename}
              onChange={(e) => setSubjectRename(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleSubjectRename();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubjectRename("")}>
              Cancel
            </Button>
            <Button
              onClick={handleSubjectRename}
              disabled={busy}
              className="bg-gradient-primary text-white"
            >
              {busy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={subjectDeleteOpen} onOpenChange={setSubjectDeleteOpen}>
        <AlertDialogContent className="clay border-0">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{subject.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the subject, all topics, and related progress for both partners. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSubjectDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete subject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!editTopic} onOpenChange={(o) => !o && setEditTopic(null)}>
        <DialogContent className="clay border-0">
          <DialogHeader>
            <DialogTitle>Rename topic</DialogTitle>
          </DialogHeader>
          {editTopic && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="et-name">Topic name</Label>
                <Input
                  id="et-name"
                  value={editTopic.name}
                  onChange={(e) => setEditTopic({ ...editTopic, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="et-desc">Description (optional)</Label>
                <Textarea
                  id="et-desc"
                  rows={3}
                  value={editTopic.description}
                  onChange={(e) => setEditTopic({ ...editTopic, description: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTopic(null)}>
              Cancel
            </Button>
            <Button
              className="bg-gradient-primary text-white"
              onClick={async () => {
                if (!editTopic || !editTopic.name.trim()) return;
                await updateTopic(editTopic.id, {
                  topic_name: editTopic.name.trim(),
                  description: editTopic.description.trim() || null,
                });
                toast.success("Topic updated");
                setEditTopic(null);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent className="clay border-0">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this topic?</AlertDialogTitle>
            <AlertDialogDescription>
              "{confirmDelete?.name}" will be deleted for both partners along with its progress.
              This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!confirmDelete) return;
                await deleteTopic(confirmDelete.id);
                toast.success("Topic removed");
                setConfirmDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
