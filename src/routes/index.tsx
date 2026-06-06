import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { ArrowRight, CheckCircle2, Sparkles, Users2, LineChart, Zap } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Let's be in sync — Study together, in real time" },
      { name: "description", content: "A premium collaborative MBBS study tracker for two. Add subjects, track topics, and see each other's progress live." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* aurora background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-aurora opacity-30 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[400px] w-[600px] rounded-full bg-gradient-aishwarya opacity-20 blur-3xl" />
      </div>

      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-primary text-white shadow-glow">
            <Sparkles className="h-5 w-5" />
          </div>
          <span className="font-display text-lg font-semibold tracking-tight">Let's be in sync</span>
        </div>
        <Link
          to="/auth"
          className="rounded-lg border border-border bg-card/60 px-4 py-2 text-sm font-medium backdrop-blur transition hover:bg-card"
        >
          Sign in
        </Link>
      </header>

      <main className="mx-auto max-w-6xl px-6 pt-12 pb-24">
        <div className="mx-auto max-w-3xl text-center animate-fade-in">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
            Built for Abhay & Aishwarya
          </span>
          <h1 className="mt-6 font-display text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl">
            Study together,
            <br />
            <span className="text-gradient">stay in sync.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground md:text-lg">
            A collaborative MBBS tracker for two. Add subjects, tick off topics, and watch each other's progress climb — live.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/auth"
              className="group inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-6 py-3 text-sm font-semibold text-white shadow-glow transition hover:scale-[1.02]"
            >
              Get started
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#features"
              className="rounded-xl border border-border bg-card/60 px-6 py-3 text-sm font-semibold backdrop-blur"
            >
              See features
            </a>
          </div>
        </div>

        <div id="features" className="mt-24 grid gap-4 md:grid-cols-3">
          {[
            { icon: Users2, title: "Built for two", body: "Side-by-side progress for Abhay & Aishwarya across all 19 MBBS subjects." },
            { icon: Zap, title: "Real-time sync", body: "Tick a topic — it updates on the other side instantly." },
            { icon: LineChart, title: "Premium analytics", body: "Streaks, heatmaps, and weekly insights that keep you both moving." },
          ].map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-border bg-card/60 p-6 shadow-card backdrop-blur transition hover:shadow-glow"
            >
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary text-white">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 rounded-3xl border border-border bg-card/60 p-8 shadow-card backdrop-blur md:p-12">
          <div className="grid items-center gap-8 md:grid-cols-2">
            <div>
              <h2 className="font-display text-3xl font-bold tracking-tight">Everything you need to finish strong</h2>
              <ul className="mt-6 space-y-3 text-sm">
                {[
                  "19 MBBS subjects preloaded",
                  "Topic-level progress with timestamps",
                  "Live comparison dashboard",
                  "Streaks, badges & milestones",
                  "Dark and light mode",
                ].map((i) => (
                  <li key={i} className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-success" /> {i}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-border bg-gradient-aurora p-1">
              <div className="rounded-2xl bg-card p-6">
                <div className="space-y-3">
                  {["Anatomy", "Physiology", "Biochemistry"].map((s, i) => (
                    <div key={s} className="flex items-center justify-between rounded-xl border border-border bg-background/60 p-3">
                      <span className="text-sm font-medium">{s}</span>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                          <div className="h-full bg-gradient-primary" style={{ width: `${30 + i * 22}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground">{30 + i * 22}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        Built with love for Abhay & Aishwarya
      </footer>
    </div>
  );
}
