import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useData } from "@/lib/data-context";
import { getSubjectIcon } from "@/lib/subject-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Label } from "@/components/ui/label";
import { Plus, Search, BookOpen, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { ClayLoader } from "@/components/clay-visuals";

export const Route = createFileRoute("/_authenticated/subjects/")({
  head: () => ({ meta: [{ title: "Subjects — Let's be in sync" }] }),
  component: SubjectsPage,
});

function SubjectsPage() {
  const {
    loading,
    subjects,
    topics,
    progress,
    profiles,
    addSubject,
    deleteSubject,
    updateSubject,
  } = useData();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const filtered = subjects.filter((s) => s.name.toLowerCase().includes(q.toLowerCase()));

  if (loading) return <ClayLoader label="Preparing your subjects" />;

  async function handleAdd() {
    if (!newName.trim()) return;
    setBusy(true);
    const res = await addSubject(newName.trim());
    setBusy(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(`Added ${newName}`);
    setNewName("");
    setOpen(false);
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    const name = confirmDelete.name;
    const id = confirmDelete.id;
    setConfirmDelete(null);
    const res = await deleteSubject(id);
    if (res.error) toast.error(`Couldn't delete: ${res.error}`);
    else toast.success(`Deleted ${name}`);
  }

  async function handleRename() {
    if (!renameTarget || !renameTarget.name.trim()) return;
    setBusy(true);
    const res = await updateSubject(renameTarget.id, { name: renameTarget.name.trim() });
    setBusy(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Subject renamed");
    setRenameTarget(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">Subjects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {subjects.length} subjects · {topics.length} topics tracked
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 md:w-72 md:flex-none">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search subjects"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary text-white shadow-glow hover:opacity-95">
                <Plus className="mr-1 h-4 w-4" /> New subject
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add a new subject</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <Label htmlFor="sname">Subject name</Label>
                <Input
                  id="sname"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. NEET PG Bridge"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleAdd}
                  disabled={busy}
                  className="bg-gradient-primary text-white"
                >
                  {busy ? "Adding…" : "Add"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => {
            const sTopics = topics.filter((t) => t.subject_id === s.id);
            const total = sTopics.length;
            const Icon = getSubjectIcon(s.icon);
            const pctFor = (uid?: string) => {
              if (!uid || total === 0) return 0;
              const done = progress.filter(
                (p) => p.user_id === uid && p.completed && sTopics.some((t) => t.id === p.topic_id),
              ).length;
              return Math.round((done / total) * 100);
            };
            const u1 = profiles[0]?.id;
            const u2 = profiles[1]?.id;
            const combinedPct = total
              ? Math.round(
                  (sTopics.filter((t) => progress.some((p) => p.topic_id === t.id && p.completed))
                    .length /
                    total) *
                    100,
                )
              : 0;

            return (
              <div key={s.id} className="group relative">
                <Link
                  to="/subjects/$id"
                  params={{ id: s.id }}
                  onClick={(e) => {
                    const x = (e.clientX / window.innerWidth) * 100;
                    const y = (e.clientY / window.innerHeight) * 100;
                    document.documentElement.style.setProperty("--page-origin-x", `${x}%`);
                    document.documentElement.style.setProperty("--page-origin-y", `${y}%`);
                  }}
                  className="block min-h-[268px] overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-glow"
                >
                  <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-primary opacity-10 blur-2xl transition group-hover:opacity-30" />
                  <div className="relative flex items-start justify-between">
                    <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-primary text-white shadow-glow">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="pr-24 text-right">
                      <div className="font-display text-2xl font-bold">{combinedPct}%</div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Combined
                      </div>
                    </div>
                  </div>
                  <h3 className="relative mt-4 font-display text-lg font-semibold">{s.name}</h3>
                  <p className="relative text-xs text-muted-foreground">{total} topics</p>

                  <div className="relative mt-4 space-y-2">
                    {profiles.slice(0, 2).map((p, i) => (
                      <div key={p.id} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium">{p.name.split(" ")[0]}</span>
                          <span className="text-muted-foreground">{pctFor(p.id)}%</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full transition-all ${i === 0 ? "bg-gradient-abhay" : "bg-gradient-aishwarya"}`}
                            style={{ width: `${pctFor(p.id)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                    {!u2 && (
                      <div className="rounded-lg border border-dashed border-border p-2 text-center text-[11px] text-muted-foreground">
                        Waiting for study partner
                      </div>
                    )}
                    {!u1 && null}
                  </div>
                </Link>
                <div className="absolute right-3 top-3 z-10 flex gap-1.5 opacity-100 transition md:opacity-90 md:group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setRenameTarget({ id: s.id, name: s.name });
                    }}
                    className="grid h-10 w-10 place-items-center rounded-full bg-card text-primary shadow-clay-sm transition hover:-translate-y-0.5 hover:text-foreground"
                    aria-label={`Rename ${s.name}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setConfirmDelete({ id: s.id, name: s.name });
                    }}
                    className="grid h-10 w-10 place-items-center rounded-full bg-card text-destructive shadow-clay-sm transition hover:-translate-y-0.5 hover:bg-destructive hover:text-destructive-foreground"
                    aria-label={`Delete ${s.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{confirmDelete?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the subject and all its topics for both partners. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete subject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!renameTarget} onOpenChange={(o) => !o && setRenameTarget(null)}>
        <DialogContent className="clay border-0">
          <DialogHeader>
            <DialogTitle>Rename subject</DialogTitle>
          </DialogHeader>
          {renameTarget && (
            <div className="space-y-3">
              <Label htmlFor="rn">Subject name</Label>
              <Input
                id="rn"
                autoFocus
                value={renameTarget.name}
                onChange={(e) => setRenameTarget({ ...renameTarget, name: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRename();
                }}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleRename}
              disabled={busy}
              className="bg-gradient-primary text-white"
            >
              {busy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-primary text-white">
        <BookOpen className="h-6 w-6" />
      </div>
      <h3 className="mt-4 font-display text-lg font-semibold">No subjects found</h3>
      <p className="text-sm text-muted-foreground">Try a different search or add a new subject.</p>
    </div>
  );
}
