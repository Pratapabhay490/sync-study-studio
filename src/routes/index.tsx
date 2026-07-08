import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { ArrowRight, CheckCircle2, Zap, LineChart, Bell, Brain } from "lucide-react";
import syncLogo from "@/assets/sync-logo.jpeg";
import clayHero from "@/assets/clay-landing-hero.png";
import clayStreak from "@/assets/clay-icon-streak.png";
import clayProgress from "@/assets/clay-icon-progress.png";
import clayPartners from "@/assets/clay-icon-partners.png";
import clayBrain from "@/assets/clay-analytics-mascot.png";
import clayBell from "@/assets/clay-bell.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Let's be in sync — Study together, in real time" },
      { name: "description", content: "A premium collaborative MBBS study tracker for partners. Add subjects, track topics, and watch each other's progress climb live." },
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
      {/* soft clay blobs */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 -left-20 h-[420px] w-[420px] rounded-full bg-[oklch(0.85_0.08_240)] opacity-40 blur-3xl" />
        <div className="absolute top-40 -right-24 h-[480px] w-[480px] rounded-full bg-[oklch(0.85_0.09_320)] opacity-40 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-[380px] w-[380px] rounded-full bg-[oklch(0.88_0.08_180)] opacity-30 blur-3xl" />
      </div>

      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-primary text-white shadow-clay-sm">
            <Sparkles className="h-5 w-5" />
          </div>
          <span className="font-display text-lg font-semibold tracking-tight">Let's be in sync</span>
        </div>
        <Link
          to="/auth"
          className="clay rounded-xl border-0 px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5"
        >
          Sign in
        </Link>
      </header>

      <main className="mx-auto max-w-6xl px-6 pt-6 pb-24">
        {/* HERO */}
        <section className="grid items-center gap-10 md:grid-cols-2">
          <div className="animate-fade-in">
            <span className="clay inline-flex items-center gap-2 rounded-full border-0 px-3 py-1.5 text-xs font-semibold text-primary shadow-clay-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              The collaborative study room for med students
            </span>
            <h1 className="mt-5 font-display text-5xl font-bold leading-[1.02] tracking-tight md:text-6xl lg:text-7xl">
              Study together,
              <br />
              <span className="text-gradient">stay in sync.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground md:text-lg">
              A premium MBBS tracker built for partners. Tick off topics, race friendly streaks, and let an AI coach map your next move — all in real time.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/auth"
                className="group inline-flex items-center gap-2 rounded-2xl bg-gradient-primary px-6 py-3.5 text-sm font-semibold text-white shadow-glow transition hover:-translate-y-0.5 hover:scale-[1.02]"
              >
                Start studying together
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
              <a
                href="#features"
                className="clay rounded-2xl border-0 px-6 py-3.5 text-sm font-semibold transition hover:-translate-y-0.5"
              >
                See how it works
              </a>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-5 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-success" /> 19 MBBS subjects preloaded</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-success" /> Realtime sync</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-success" /> AI study coach</span>
            </div>
          </div>

          {/* hero illustration */}
          <div className="relative">
            <div className="absolute inset-0 -z-10 rounded-[40px] bg-gradient-aurora opacity-30 blur-3xl" />
            <img
              src={clayHero}
              alt="Two medical students studying together with laptops and books"
              width={1280}
              height={1024}
              className="relative w-full max-w-[560px] mx-auto animate-float-slow drop-shadow-[0_30px_50px_rgba(15,23,42,0.25)]"
            />
            {/* floating mini-cards */}
            <div className="clay absolute -left-2 top-10 hidden rounded-2xl border-0 px-3 py-2 shadow-clay-sm md:flex items-center gap-2 animate-float-slow">
              <img src={clayStreak} alt="" width={32} height={32} className="h-8 w-8" />
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Streak</div>
                <div className="text-sm font-bold">12 days 🔥</div>
              </div>
            </div>
            <div className="clay absolute -right-2 bottom-12 hidden rounded-2xl border-0 px-3 py-2 shadow-clay-sm md:flex items-center gap-2 animate-float-slow">
              <img src={clayProgress} alt="" width={32} height={32} className="h-8 w-8" />
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">This week</div>
                <div className="text-sm font-bold">+47 topics</div>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section id="features" className="mt-28">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
              Everything two students need to <span className="text-gradient">finish strong.</span>
            </h2>
            <p className="mt-3 text-sm text-muted-foreground md:text-base">
              Less app, more accountability. Built around the way you actually study.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {[
              { icon: clayPartners, title: "Side-by-side progress", body: "See your partner's completed topics, streaks, and momentum in real time." },
              { icon: clayBrain, title: "AI study coach", body: "Gemini-powered insights spot patterns and tell you exactly what to revise next." },
              { icon: clayBell, title: "Smart nudges", body: "Poke each other, get celebration pings on completions, and 5 daily motivation bumps." },
            ].map((f) => (
              <div
                key={f.title}
                className="clay group rounded-3xl border-0 p-6 transition hover:-translate-y-1"
              >
                <div className="grid h-16 w-16 place-items-center rounded-2xl bg-background/40">
                  <img src={f.icon} alt="" width={64} height={64} className="h-14 w-14 transition group-hover:rotate-[-6deg]" />
                </div>
                <h3 className="mt-5 font-display text-lg font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* PREVIEW CARD */}
        <section className="mt-20 clay rounded-[36px] border-0 p-8 md:p-12">
          <div className="grid items-center gap-10 md:grid-cols-2">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">Built for two</span>
              <h2 className="mt-2 font-display text-3xl font-bold tracking-tight md:text-4xl">
                One dashboard. Both your progress.
              </h2>
              <ul className="mt-6 space-y-3 text-sm">
                {[
                  { icon: Zap, label: "Realtime topic syncing across devices" },
                  { icon: LineChart, label: "Heatmaps, streaks, weekly analytics" },
                  { icon: Brain, label: "AI coach that reads your last 7 days" },
                  { icon: Bell, label: "Browser push, even when the tab is closed" },
                ].map((i) => (
                  <li key={i.label} className="flex items-center gap-3">
                    <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-primary text-white shadow-clay-sm">
                      <i.icon className="h-4 w-4" />
                    </span>
                    <span className="text-foreground/85">{i.label}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="clay-pressed rounded-3xl p-4">
              <div className="space-y-3">
                {[
                  { s: "Anatomy", a: 72, b: 58 },
                  { s: "Physiology", a: 64, b: 70 },
                  { s: "Pathology", a: 48, b: 55 },
                  { s: "Pharmacology", a: 30, b: 42 },
                ].map((r) => (
                  <div key={r.s} className="rounded-2xl bg-background/70 p-3 shadow-clay-sm">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold">{r.s}</span>
                      <span className="text-muted-foreground">{r.a}% · {r.b}%</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-gradient-abhay" style={{ width: `${r.a}%` }} />
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-gradient-aishwarya" style={{ width: `${r.b}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mt-20 text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight md:text-5xl">
            Ready to <span className="text-gradient">stay in sync?</span>
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground md:text-base">
            Sign up free, invite your study partner by email, and start ticking topics together today.
          </p>
          <Link
            to="/auth"
            className="mt-7 inline-flex items-center gap-2 rounded-2xl bg-gradient-primary px-7 py-4 text-sm font-semibold text-white shadow-glow transition hover:-translate-y-0.5 hover:scale-[1.02]"
          >
            Create your study room
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      </main>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        Made with care for medical students everywhere.
      </footer>
    </div>
  );
}
