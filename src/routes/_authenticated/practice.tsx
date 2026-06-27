import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Brain, Sparkles, Play, Upload, FileText, Trash2, Check, X as XIcon,
  Bookmark, BookmarkCheck, Clock, Trophy, Zap, ChevronRight, Loader2, Users,
  AlertCircle, RefreshCw, BookOpen, BarChart3, Pause,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useData } from "@/lib/data-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user-avatar";
import { ProgressRing } from "@/components/progress-ring";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { celebrate } from "@/lib/celebrate";
import { toast } from "sonner";
import {
  sb, generateQuestions, embedDocument,
  type QuizQuestion, type QuizSession, type QuizPlayer, type QuizDocument,
} from "@/lib/practice";

export const Route = createFileRoute("/_authenticated/practice")({
  component: PracticePage,
});

const DIFFICULTIES = [
  { v: "easy", l: "Easy" },
  { v: "medium", l: "Medium" },
  { v: "hard", l: "Hard" },
  { v: "neetpg", l: "NEET PG" },
  { v: "inicet", l: "INICET" },
];

function PracticePage() {
  const { user } = useAuth();
  const { profiles, subjects } = useData();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [view, setView] = useState<"lobby" | "active" | "results">("lobby");

  // Resume any active session this user belongs to
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await sb
        .from("quiz_sessions")
        .select("*")
        .or(`host_id.eq.${user.id},partner_id.eq.${user.id}`)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1);
      if (Array.isArray(data) && data[0]) {
        setSessionId(data[0].id);
        setView("active");
      }
    })();
  }, [user]);

  if (view === "active" && sessionId) {
    return (
      <ActiveSession
        sessionId={sessionId}
        onFinish={() => setView("results")}
        onExit={() => { setSessionId(null); setView("lobby"); }}
      />
    );
  }
  if (view === "results" && sessionId) {
    return (
      <SessionResults
        sessionId={sessionId}
        onAgain={() => { setSessionId(null); setView("lobby"); }}
      />
    );
  }
  return (
    <Lobby
      subjects={subjects}
      onSessionStarted={(id) => { setSessionId(id); setView("active"); }}
    />
  );
}

/* ============================= LOBBY ============================= */

function Lobby({
  subjects,
  onSessionStarted,
}: {
  subjects: { id: string; name: string }[];
  onSessionStarted: (id: string) => void;
}) {
  const { user } = useAuth();
  const { profiles } = useData();
  const partner = profiles.find((p) => p.id !== user?.id);

  const [mode, setMode] = useState<"solo" | "duo">(partner ? "duo" : "solo");
  const [subject, setSubject] = useState<string>("");
  const [topic, setTopic] = useState<string>("");
  const [difficulty, setDifficulty] = useState<string>("medium");
  const [count, setCount] = useState<number>(10);
  const [seconds, setSeconds] = useState<number>(60);
  const [source, setSource] = useState<"ai" | "rag">("ai");
  const [pickedDocIds, setPickedDocIds] = useState<string[]>([]);
  const [starting, setStarting] = useState(false);
  const startingRef = useRef(false);

  // documents
  const [docs, setDocs] = useState<QuizDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);

  const loadDocs = useCallback(async () => {
    const { data } = await sb
      .from("quiz_documents")
      .select("id,title,source_type,subject,topic,char_count,chunk_count,status,created_at")
      .order("created_at", { ascending: false });
    setDocs((data as QuizDocument[] | null) ?? []);
    setDocsLoading(false);
  }, []);
  useEffect(() => { loadDocs(); }, [loadDocs]);

  // Pending invites (sessions where I'm partner but not yet active)
  const [invites, setInvites] = useState<QuizSession[]>([]);
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await sb
        .from("quiz_sessions")
        .select("*")
        .eq("status", "lobby")
        .or(`host_id.eq.${user.id},partner_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(5);
      setInvites((data as QuizSession[] | null) ?? []);
    };
    load();
    const ch = sb.channel("lobby-watch")
      .on("postgres_changes", { event: "*", schema: "public", table: "quiz_sessions" }, load)
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [user]);

  async function startSession() {
    if (!user) return;
    // Synchronous ref guard: blocks a second click that lands before React
    // flushes the `starting` state update from the first click.
    if (startingRef.current) {
      console.warn("[startSession] duplicate click ignored");
      return;
    }
    startingRef.current = true;
    setStarting(true);
    const clickId = (globalThis.crypto?.randomUUID?.() ?? `click_${Date.now()}`);
    console.info("[startSession] begin", { click_id: clickId, mode, subject, topic, difficulty, count, source });
    try {
      // 1) Create session row
      const { data: newSess, error: sErr } = await sb
        .from("quiz_sessions")
        .insert({
          host_id: user.id,
          partner_id: mode === "duo" ? partner?.id ?? null : null,
          mode,
          subject: subject || null,
          topic: topic || null,
          difficulty,
          source,
          document_ids: source === "rag" ? pickedDocIds : [],
          question_count: count,
          seconds_per_question: seconds,
          status: "lobby",
        })
        .select()
        .single();
      if (sErr || !newSess) throw new Error(sErr?.message ?? "session_failed");

      // 2) Generate questions via edge fn (single backend call; no client→Gemini)
      toast.info("Generating questions with AI…");
      const { questions, error: gErr } = await generateQuestions({
        subject, topic, difficulty, count, source,
        document_ids: pickedDocIds,
      });
      if (gErr || !questions.length) {
        await sb.from("quiz_sessions").delete().eq("id", newSess.id);
        throw new Error(gErr || "no_questions");
      }

      // 3) Lock question order via RPC
      const { error: rpcErr } = await sb.rpc("start_quiz_session", {
        p_session_id: newSess.id,
        p_question_ids: questions.map((q) => q.id),
      });
      if (rpcErr) throw new Error(rpcErr.message);

      toast.success("Quiz ready!");
      onSessionStarted(newSess.id);
    } catch (e: any) {
      toast.error("Couldn't start quiz: " + (e?.message ?? String(e)));
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  }

  async function joinInvite(id: string) {
    const { error } = await sb.rpc("join_quiz_session", { p_session_id: id });
    if (error) { toast.error(error.message); return; }
    onSessionStarted(id);
  }

  return (
    <div className="space-y-6">
      {/* header */}
      <header className="clay flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-primary text-white shadow-clay-sm">
            <Brain className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold md:text-3xl">AI MCQ Practice</h1>
            <p className="text-sm text-muted-foreground">
              Solo or duo. Lockstep questions. AI-graded with explanations.
            </p>
          </div>
        </div>
        <Button onClick={() => setUploadOpen(true)} variant="outline" className="gap-2">
          <Upload className="h-4 w-4" /> Upload notes
        </Button>
      </header>

      {invites.filter((s) => s.partner_id === user?.id && s.host_id !== user?.id).map((inv) => (
        <div key={inv.id} className="clay flex flex-wrap items-center gap-3 p-4">
          <Users className="h-5 w-5 text-primary" />
          <div className="flex-1 text-sm">
            <span className="font-semibold">Your partner started a quiz</span>{" "}
            <span className="text-muted-foreground">
              · {inv.subject ?? "Mixed"} · {inv.question_count}q · {inv.difficulty}
            </span>
          </div>
          <Button size="sm" onClick={() => joinInvite(inv.id)}>Join</Button>
        </div>
      ))}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* setup card */}
        <section className="clay space-y-5 p-6 lg:col-span-2">
          <h2 className="font-display text-lg font-bold">New session</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Mode">
              <div className="flex gap-2">
                <ModeChip active={mode === "solo"} onClick={() => setMode("solo")}>Solo</ModeChip>
                <ModeChip active={mode === "duo"} onClick={() => setMode("duo")} disabled={!partner}>
                  Duo {partner ? `· ${partner.name}` : "(no partner)"}
                </ModeChip>
              </div>
            </Field>

            <Field label="Difficulty">
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DIFFICULTIES.map((d) => <SelectItem key={d.v} value={d.v}>{d.l}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Subject (optional)">
              <Select value={subject || "__none"} onValueChange={(v) => setSubject(v === "__none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Any subject</SelectItem>
                  {subjects.map((s) => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Topic (optional)">
              <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Beta blockers" />
            </Field>

            <Field label={`Questions: ${count}`}>
              <input type="range" min={5} max={20} value={count}
                onChange={(e) => setCount(parseInt(e.target.value))} className="w-full accent-primary" />
            </Field>

            <Field label={`Seconds / question: ${seconds}`}>
              <input type="range" min={20} max={120} step={5} value={seconds}
                onChange={(e) => setSeconds(parseInt(e.target.value))} className="w-full accent-primary" />
            </Field>
          </div>

          <div className="space-y-3">
            <Field label="Question source">
              <div className="flex gap-2">
                <ModeChip active={source === "ai"} onClick={() => setSource("ai")}>
                  <Sparkles className="mr-1 inline h-3.5 w-3.5" /> AI knowledge
                </ModeChip>
                <ModeChip active={source === "rag"} onClick={() => setSource("rag")} disabled={!docs.length}>
                  <FileText className="mr-1 inline h-3.5 w-3.5" /> From my notes {!docs.length && "(none)"}
                </ModeChip>
              </div>
            </Field>
            {source === "rag" && (
              <div className="clay-pressed space-y-2 p-3">
                <div className="text-xs font-semibold text-muted-foreground">
                  Pick notes (leave empty = all)
                </div>
                <div className="flex flex-wrap gap-2">
                  {docs.map((d) => {
                    const on = pickedDocIds.includes(d.id);
                    return (
                      <button
                        key={d.id}
                        onClick={() => setPickedDocIds((p) =>
                          on ? p.filter((x) => x !== d.id) : [...p, d.id])}
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-medium transition-all",
                          on ? "bg-gradient-primary text-white shadow-clay-sm"
                             : "bg-card text-foreground/70 shadow-clay-sm",
                        )}
                      >
                        {d.title} · {d.chunk_count} chunks
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <Button size="lg" className="w-full gap-2" disabled={starting} onClick={startSession}>
            {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {starting ? "Generating questions…" : "Start session"}
          </Button>
        </section>

        {/* sidebar */}
        <section className="clay space-y-4 p-6">
          <h2 className="font-display text-lg font-bold">Your notes</h2>
          {docsLoading ? (
            <div className="clay-pressed p-4 text-center text-sm text-muted-foreground">Loading…</div>
          ) : docs.length === 0 ? (
            <div className="clay-pressed p-4 text-center text-sm text-muted-foreground">
              Upload .txt or .md to ground questions in your own notes.
            </div>
          ) : (
            <ul className="space-y-2">
              {docs.map((d) => <DocRow key={d.id} doc={d} onChange={loadDocs} />)}
            </ul>
          )}
          <Button variant="outline" className="w-full gap-2" onClick={() => setUploadOpen(true)}>
            <Upload className="h-4 w-4" /> Upload notes
          </Button>

          <div className="pt-2">
            <h3 className="mb-2 font-display text-sm font-bold">Quick links</h3>
            <div className="flex flex-col gap-2 text-sm">
              <WrongBankLink />
            </div>
          </div>
        </section>
      </div>

      <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} onCreated={loadDocs} />
    </div>
  );
}

function ModeChip({
  active, children, onClick, disabled,
}: { active: boolean; children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-2xl px-4 py-2 text-sm font-semibold transition-all shadow-clay-sm",
        active ? "bg-gradient-primary text-white" : "bg-card text-foreground/80 hover:-translate-y-0.5",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-xs font-semibold text-muted-foreground">{label}</div>
      {children}
    </label>
  );
}

function DocRow({ doc, onChange }: { doc: QuizDocument; onChange: () => void }) {
  async function remove() {
    if (!confirm(`Delete "${doc.title}"?`)) return;
    await sb.from("quiz_documents").delete().eq("id", doc.id);
    onChange();
  }
  return (
    <li className="clay-pressed flex items-center gap-3 p-3">
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-primary text-white shadow-clay-sm">
        <FileText className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{doc.title}</div>
        <div className="truncate text-xs text-muted-foreground">
          {doc.status === "ready"
            ? `${doc.chunk_count} chunks · ${Math.round(doc.char_count / 1000)}k chars`
            : doc.status}
        </div>
      </div>
      <button onClick={remove} aria-label="Delete" className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:text-destructive">
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}

function WrongBankLink() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    sb.from("quiz_wrong_bank").select("id", { count: "exact", head: true }).eq("resolved", false)
      .then(({ count: c }: any) => setCount(c ?? 0));
  }, []);
  return (
    <div className="clay-pressed flex items-center gap-3 p-3 text-sm">
      <BookOpen className="h-4 w-4 text-primary" />
      <span className="flex-1">Wrong question bank</span>
      <Badge variant="secondary">{count}</Badge>
    </div>
  );
}

/* ============================= UPLOAD DIALOG ============================= */

function UploadDialog({
  open, onOpenChange, onCreated,
}: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);

  async function onFile(f: File) {
    if (!/\.(txt|md|markdown|pdf|docx)$/i.test(f.name)) {
      toast.error("Supported: .pdf, .docx, .txt, .md");
      return;
    }
    try {
      toast.info(`Reading ${f.name}…`);
      const { extractTextFromFile } = await import("@/lib/document-extract");
      const t = await extractTextFromFile(f);
      setText(t);
      if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
      toast.success(`Loaded ${t.length.toLocaleString()} characters`);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not read file");
    }
  }


  async function submit() {
    if (!user) return;
    const cleanText = text.trim();
    if (!title.trim() || !cleanText) { toast.error("Add a title and some text."); return; }
    setBusy(true);
    try {
      const { data: doc, error } = await sb.from("quiz_documents").insert({
        user_id: user.id,
        title: title.trim().slice(0, 200),
        source_type: "text",
        subject: subject.trim() || null,
        topic: topic.trim() || null,
        char_count: cleanText.length,
        status: "embedding",
      }).select().single();
      if (error || !doc) throw new Error(error?.message ?? "insert_failed");

      toast.info("Embedding notes…");
      const { data: embRes, error: embErr } = await embedDocument(doc.id, cleanText);
      if (embErr || embRes?.error) {
        await sb.from("quiz_documents").update({ status: "error", error: embRes?.error ?? String(embErr?.message ?? embErr) }).eq("id", doc.id);
        throw new Error(embRes?.error ?? embErr?.message ?? "embed_failed");
      }
      toast.success(`Indexed ${embRes?.chunk_count ?? 0} chunks`);
      setTitle(""); setText(""); setSubject(""); setTopic("");
      onOpenChange(false);
      onCreated();
    } catch (e: any) {
      toast.error("Upload failed: " + (e?.message ?? String(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Upload study notes</DialogTitle></DialogHeader>
        <Tabs defaultValue="paste" className="w-full">
          <TabsList>
            <TabsTrigger value="paste">Paste text</TabsTrigger>
            <TabsTrigger value="file">From file (PDF/DOCX/TXT/MD)</TabsTrigger>
          </TabsList>
          <TabsContent value="paste" className="space-y-3 pt-3">
            <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Subject (optional)" value={subject} onChange={(e) => setSubject(e.target.value)} />
              <Input placeholder="Topic (optional)" value={topic} onChange={(e) => setTopic(e.target.value)} />
            </div>
            <Textarea
              placeholder="Paste your notes here…"
              value={text} onChange={(e) => setText(e.target.value)}
              className="min-h-[220px]"
            />
          </TabsContent>
          <TabsContent value="file" className="space-y-3 pt-3">
            <label
              htmlFor="quiz-file-input"
              className="flex flex-col items-center justify-center gap-2 cursor-pointer rounded-2xl border-2 border-dashed border-border bg-muted/40 hover:bg-muted/70 transition-colors px-6 py-10 text-center"
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <div className="text-sm font-semibold">Click to choose a file from your device</div>
              <div className="text-xs text-muted-foreground">Supported: .pdf, .docx, .txt, .md (parsed in your browser)</div>
            </label>
            <input
              id="quiz-file-input"
              type="file"
              accept=".txt,.md,.markdown,.pdf,.docx,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
              className="sr-only"
            />
            <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <div className="text-xs text-muted-foreground">{text.length.toLocaleString()} chars loaded {text.length > 0 ? "✓" : ""}</div>
          </TabsContent>


        </Tabs>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Upload &amp; index
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================= ACTIVE SESSION ============================= */

function ActiveSession({
  sessionId, onFinish, onExit,
}: { sessionId: string; onFinish: () => void; onExit: () => void }) {
  const { user } = useAuth();
  const { profiles } = useData();

  const [session, setSession] = useState<QuizSession | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [players, setPlayers] = useState<QuizPlayer[]>([]);
  const [myAnswers, setMyAnswers] = useState<Record<number, { selected: number | null; correct: boolean }>>({});
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [position, setPosition] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const startedAtRef = useRef<number>(Date.now());

  // Initial load
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: s }, { data: sq }, { data: pp }] = await Promise.all([
        sb.from("quiz_sessions").select("*").eq("id", sessionId).single(),
        sb.from("quiz_session_questions")
          .select("position, question_id, quiz_questions:question_id(*)")
          .eq("session_id", sessionId)
          .order("position"),
        sb.from("quiz_session_players").select("*").eq("session_id", sessionId),
      ]);
      if (cancelled) return;
      setSession(s as QuizSession);
      const qs: QuizQuestion[] = (sq ?? []).map((r: any) => r.quiz_questions).filter(Boolean);
      setQuestions(qs);
      setPlayers((pp as QuizPlayer[] | null) ?? []);
      // ensure I'm a player
      if (user) {
        const has = (pp ?? []).some((p: any) => p.user_id === user.id);
        if (!has) {
          await sb.rpc("join_quiz_session", { p_session_id: sessionId });
        }
      }
      // load my prior answers (in case of refresh)
      const { data: ans } = await sb.from("quiz_answers")
        .select("*").eq("session_id", sessionId).eq("user_id", user?.id);
      const map: typeof myAnswers = {};
      (ans ?? []).forEach((a: any) => {
        map[a.position] = { selected: a.selected_index, correct: a.is_correct };
      });
      setMyAnswers(map);
      const nextPos = Math.min(Object.keys(map).length, (qs.length || 1) - 1);
      setPosition(nextPos);

      // load bookmarks
      const { data: bm } = await sb.from("quiz_bookmarks").select("question_id");
      setBookmarks(new Set((bm ?? []).map((b: any) => b.question_id)));
    })();
    return () => { cancelled = true; };
  }, [sessionId, user]);

  // Realtime: players + answers
  useEffect(() => {
    const ch = sb.channel(`sess-${sessionId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "quiz_session_players", filter: `session_id=eq.${sessionId}` },
        async () => {
          const { data } = await sb.from("quiz_session_players").select("*").eq("session_id", sessionId);
          setPlayers((data as QuizPlayer[] | null) ?? []);
        })
      .on("postgres_changes",
        { event: "*", schema: "public", table: "quiz_sessions", filter: `id=eq.${sessionId}` },
        ({ new: row }: any) => row && setSession(row as QuizSession))
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [sessionId]);

  // Per-question timer
  useEffect(() => {
    if (!session || submitted) return;
    setTimeLeft(session.seconds_per_question);
    startedAtRef.current = Date.now();
    const t = setInterval(() => {
      setTimeLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          // auto-submit on timeout
          submitAnswer(null);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position, session, submitted]);

  // Reset per-question state when position changes
  useEffect(() => {
    const prev = myAnswers[position];
    if (prev) {
      setSelected(prev.selected);
      setSubmitted(true);
    } else {
      setSelected(null);
      setSubmitted(false);
    }
  }, [position, myAnswers]);

  const q = questions[position];
  const me = players.find((p) => p.user_id === user?.id);
  const partnerPlayer = players.find((p) => p.user_id !== user?.id);
  const meProfile = profiles.find((p) => p.id === user?.id);
  const partnerProfile = profiles.find((p) => p.id === partnerPlayer?.user_id);
  const total = questions.length;

  async function submitAnswer(forceSelected: number | null) {
    if (submitted || !q || !user) return;
    setSubmitted(true);
    const choice = forceSelected !== null ? forceSelected : selected;
    const ms = Date.now() - startedAtRef.current;
    const { data: isCorrect } = await sb.rpc("submit_quiz_answer", {
      p_session_id: sessionId,
      p_position: position,
      p_question_id: q.id,
      p_selected_index: choice,
      p_ms_taken: ms,
    });
    setMyAnswers((m) => ({ ...m, [position]: { selected: choice, correct: !!isCorrect } }));
    if (isCorrect) celebrate(0.5, 0.4);
  }

  async function toggleBookmark() {
    if (!q || !user) return;
    if (bookmarks.has(q.id)) {
      await sb.from("quiz_bookmarks").delete().eq("user_id", user.id).eq("question_id", q.id);
      setBookmarks((s) => { const n = new Set(s); n.delete(q.id); return n; });
    } else {
      await sb.from("quiz_bookmarks").insert({ user_id: user.id, question_id: q.id });
      setBookmarks((s) => new Set(s).add(q.id));
    }
  }

  async function next() {
    if (position + 1 >= total) {
      // finish
      await sb.from("quiz_session_players").update({ status: "finished", finished_at: new Date().toISOString() })
        .eq("session_id", sessionId).eq("user_id", user!.id);
      const allFinished = players.every((p) => p.user_id === user?.id || p.status === "finished");
      if (allFinished || (session?.mode === "solo")) {
        await sb.from("quiz_sessions").update({ status: "finished", finished_at: new Date().toISOString() })
          .eq("id", sessionId);
      }
      onFinish();
      return;
    }
    setPosition(position + 1);
  }

  if (!session || !q) {
    return (
      <div className="clay grid place-items-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const progressPct = Math.round(((position + (submitted ? 1 : 0)) / total) * 100);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        {/* top bar */}
        <div className="clay flex items-center gap-3 p-4">
          <Badge variant="secondary" className="gap-1"><Zap className="h-3 w-3" /> {q.difficulty}</Badge>
          {q.subject && <Badge variant="outline">{q.subject}</Badge>}
          {q.source === "rag" && <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">From notes</Badge>}
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-sm font-semibold">
              <Clock className="h-4 w-4" /> {timeLeft}s
            </div>
            <button onClick={toggleBookmark} aria-label="Bookmark" className="grid h-9 w-9 place-items-center rounded-xl bg-card shadow-clay-sm">
              {bookmarks.has(q.id) ? <BookmarkCheck className="h-4 w-4 text-primary" /> : <Bookmark className="h-4 w-4" />}
            </button>
            <button onClick={onExit} aria-label="Exit" className="grid h-9 w-9 place-items-center rounded-xl bg-card shadow-clay-sm">
              <XIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* progress */}
        <div className="clay-pressed h-3 overflow-hidden p-0">
          <div className="h-full rounded-full bg-gradient-primary transition-all" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="text-xs text-muted-foreground">Question {position + 1} of {total}</div>

        {/* question card */}
        <div className="clay space-y-4 p-6">
          <h2 className="text-lg font-semibold leading-relaxed">{q.stem}</h2>
          <div className="grid gap-2">
            {q.options.map((opt, i) => {
              const chosen = selected === i;
              const correct = q.correct_index === i;
              const showState = submitted;
              return (
                <button
                  key={i}
                  disabled={submitted}
                  onClick={() => setSelected(i)}
                  className={cn(
                    "group flex items-start gap-3 rounded-2xl p-4 text-left shadow-clay-sm transition-all",
                    !submitted && (chosen ? "bg-gradient-primary text-white" : "bg-card hover:-translate-y-0.5"),
                    submitted && correct && "bg-emerald-500/15 ring-2 ring-emerald-500",
                    submitted && chosen && !correct && "bg-rose-500/15 ring-2 ring-rose-500",
                    submitted && !chosen && !correct && "bg-card opacity-70",
                  )}
                >
                  <span className={cn(
                    "grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold",
                    !submitted && chosen ? "bg-white/20 text-white" : "bg-foreground/10",
                  )}>
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="flex-1 text-sm font-medium">{opt}</span>
                  {showState && correct && <Check className="h-4 w-4 text-emerald-600" />}
                  {showState && chosen && !correct && <XIcon className="h-4 w-4 text-rose-600" />}
                </button>
              );
            })}
          </div>

          {submitted && (
            <div className="space-y-3 rounded-2xl bg-foreground/[0.03] p-4">
              <div className="flex items-center gap-2 font-semibold">
                <Sparkles className="h-4 w-4 text-primary" /> AI Explanation
              </div>
              {q.explanation && <p className="text-sm leading-relaxed">{q.explanation}</p>}
              {q.pearls && (
                <div className="rounded-xl bg-amber-500/10 p-3 text-xs">
                  <span className="font-bold">High-yield: </span>{q.pearls}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            {!submitted ? (
              <>
                <Button variant="outline" onClick={() => submitAnswer(null)}>Skip</Button>
                <Button className="ml-auto gap-2" disabled={selected === null} onClick={() => submitAnswer(selected)}>
                  Submit <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <Button className="ml-auto gap-2" onClick={next}>
                {position + 1 >= total ? "Finish" : "Next"} <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* right: live partner panel */}
      <aside className="space-y-4">
        <PlayerCard label="You" profile={meProfile} player={me} total={total} highlight />
        {session.mode === "duo" ? (
          partnerPlayer ? (
            <PlayerCard label="Partner" profile={partnerProfile} player={partnerPlayer} total={total} />
          ) : (
            <div className="clay p-4 text-center text-sm text-muted-foreground">
              <Users className="mx-auto mb-2 h-5 w-5" />
              Waiting for partner to join…
            </div>
          )
        ) : (
          <div className="clay p-4 text-center text-sm text-muted-foreground">Solo mode</div>
        )}
      </aside>
    </div>
  );
}

function PlayerCard({
  label, profile, player, total, highlight,
}: {
  label: string;
  profile: any;
  player: QuizPlayer | undefined;
  total: number;
  highlight?: boolean;
}) {
  const pct = player && total ? Math.round((player.attempted_count / total) * 100) : 0;
  const acc = player && player.attempted_count
    ? Math.round((player.correct_count / player.attempted_count) * 100) : 0;
  return (
    <div className={cn("clay p-4", highlight && "ring-2 ring-primary/40")}>
      <div className="flex items-center gap-3">
        <UserAvatar profile={profile} size={40} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold">{profile?.name ?? label}</div>
          <div className="text-xs text-muted-foreground">
            {player?.status === "finished" ? "✓ Finished" :
             player?.status === "answered" ? "Answered" : "Thinking…"}
          </div>
        </div>
        <ProgressRing value={pct} size={48} stroke={5} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat label="Score" value={String(player?.score ?? 0)} />
        <Stat label="Correct" value={`${player?.correct_count ?? 0}/${player?.attempted_count ?? 0}`} />
        <Stat label="Accuracy" value={`${acc}%`} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="clay-pressed py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-display text-base font-bold">{value}</div>
    </div>
  );
}

/* ============================= RESULTS ============================= */

function SessionResults({
  sessionId, onAgain,
}: { sessionId: string; onAgain: () => void }) {
  const { user } = useAuth();
  const { profiles } = useData();
  const [players, setPlayers] = useState<QuizPlayer[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    (async () => {
      const [{ data: pp }, { count }] = await Promise.all([
        sb.from("quiz_session_players").select("*").eq("session_id", sessionId),
        sb.from("quiz_session_questions").select("position", { count: "exact", head: true }).eq("session_id", sessionId),
      ]);
      setPlayers((pp as QuizPlayer[] | null) ?? []);
      setTotal(count ?? 0);
      celebrate(0.5, 0.4);
    })();
  }, [sessionId]);

  const sorted = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="space-y-6">
      <header className="clay flex items-center gap-4 p-6">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-primary text-white shadow-clay-sm">
          <Trophy className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h1 className="font-display text-2xl font-bold">Quiz complete</h1>
          <p className="text-sm text-muted-foreground">{total} questions · {players.length} player(s)</p>
        </div>
        <Button onClick={onAgain} className="gap-2"><RefreshCw className="h-4 w-4" /> New session</Button>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {sorted.map((p, i) => {
          const pr = profiles.find((x) => x.id === p.user_id);
          const acc = p.attempted_count ? Math.round((p.correct_count / p.attempted_count) * 100) : 0;
          return (
            <div key={p.id} className={cn("clay p-5", i === 0 && "ring-2 ring-amber-400/60")}>
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-primary text-white shadow-clay-sm">
                  {i === 0 ? <Trophy className="h-5 w-5" /> : <span className="font-bold">#{i + 1}</span>}
                </div>
                <UserAvatar profile={pr} size={40} />
                <div className="flex-1">
                  <div className="font-display font-bold">{pr?.name ?? "Player"}</div>
                  <div className="text-xs text-muted-foreground">{p.user_id === user?.id ? "You" : "Partner"}</div>
                </div>
                <ProgressRing value={acc} size={56} stroke={6} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <Stat label="Score" value={String(p.score)} />
                <Stat label="Correct" value={`${p.correct_count}/${p.attempted_count}`} />
                <Stat label="Accuracy" value={`${acc}%`} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="clay flex items-center gap-3 p-5">
        <BarChart3 className="h-5 w-5 text-primary" />
        <p className="flex-1 text-sm text-muted-foreground">
          Wrong answers were auto-added to your spaced-repetition bank. They'll resurface for review over the next 1, 3, 7, 15, and 30 days.
        </p>
        <AlertCircle className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );
}
