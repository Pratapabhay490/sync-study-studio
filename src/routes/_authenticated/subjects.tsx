import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useData } from "@/lib/data-context";
import { getSubjectIcon } from "@/lib/subject-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Search, BookOpen } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/subjects")({
  head: () => ({ meta: [{ title: "Subjects — Let's be in sync" }] }),
  component: SubjectsPage,
});

function SubjectsPage() {
  const { subjects, topics, progress, profiles, addSubject } = useData();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const filtered = subjects.filter((s) => s.name.toLowerCase().includes(q.toLowerCase()));

  async function handleAdd() {
    if (!newName.trim()) return;
    await addSubject(newName.trim());
    toast.success(`Added ${newName}`);
    setNewName("");
    setOpen(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">Subjects</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subjects.length} subjects · {topics.length} topics tracked</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 md:w-72 md:flex-none">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search subjects" value={q} onChange={(e) => setQ(e.target.value)} />
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
                <Input id="sname" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. NEET PG Bridge" />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={handleAdd} className="bg-gradient-primary text-white">Add</Button>
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
              const done = progress.filter((p) => p.user_id === uid && p.completed && sTopics.some((t) => t.id === p.topic_id)).length;
              return Math.round((done / total) * 100);
            };
            const u1 = profiles[0]?.id;
            const u2 = profiles[1]?.id;
            const combinedPct = total
              ? Math.round((sTopics.filter((t) => progress.some((p) => p.topic_id === t.id && p.completed)).length / total) * 100)
              : 0;

            return (
              <Link
                key={s.id}
                to="/subjects/$id"
                params={{ id: s.id }}
                className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-glow"
              >
                <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-primary opacity-10 blur-2xl transition group-hover:opacity-30" />
                <div className="relative flex items-start justify-between">
                  <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-primary text-white shadow-glow">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="text-right">
                    <div className="font-display text-2xl font-bold">{combinedPct}%</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Combined</div>
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
            );
          })}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-primary text-white"><BookOpen className="h-6 w-6" /></div>
      <h3 className="mt-4 font-display text-lg font-semibold">No subjects found</h3>
      <p className="text-sm text-muted-foreground">Try a different search or add a new subject.</p>
    </div>
  );
}
