import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { ArrowRight, CheckCircle2, Zap, LineChart, Bell, Brain, Sparkles, Star } from "lucide-react";
import hero3dOrb from "@/assets/hero-3d-orb.png";
import hero3dHeart from "@/assets/hero-3d-heart.png";
import hero3dPill from "@/assets/hero-3d-pill.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Let's be in sync — Study together, in real time" },
      { name: "description", content: "A premium collaborative MBBS study tracker for partners. Add subjects, track topics, and watch each other's progress climb live." },
    ],
  }),
  component: Landing,
});

const serif = { fontFamily: '"Instrument Serif", ui-serif, Georgia, serif' };

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050814] text-slate-100 antialiased selection:bg-blue-500/30">
      {/* Aurora orbs */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-[560px] w-[560px] rounded-full bg-blue-600/25 blur-[140px] animate-orb-a" />
        <div className="absolute top-1/3 -right-40 h-[520px] w-[520px] rounded-full bg-indigo-500/20 blur-[130px] animate-orb-b" />
        <div className="absolute bottom-0 -left-32 h-[600px] w-[600px] rounded-full bg-sky-500/10 blur-[150px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.08),transparent_60%)]" />
        <div className="absolute inset-0 opacity-[0.035] mix-blend-overlay" style={{ backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22><filter id=%22n%22><feTurbulence baseFrequency=%220.9%22/></filter><rect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/></svg>")' }} />
      </div>

      {/* Nav */}
      <header className="relative z-40 mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-blue-400 to-indigo-600 shadow-[0_0_24px_rgba(59,130,246,0.35)]">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="font-semibold tracking-tight text-[15px]">Let's be in sync</span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-slate-400 md:flex">
          <a href="#features" className="hover:text-white transition">Features</a>
          <a href="#preview" className="hover:text-white transition">Preview</a>
          <a href="#coach" className="hover:text-white transition">AI Coach</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/auth" className="hidden text-sm text-slate-300 hover:text-white px-3 py-2 md:inline-flex">
            Sign in
          </Link>
          <Link
            to="/auth"
            className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 shadow-[0_0_24px_rgba(255,255,255,0.08)] transition hover:bg-slate-100 active:scale-95"
          >
            Get started
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-6 pb-28 pt-6 md:pt-14">
        {/* HERO */}
        <section className="grid items-center gap-14 md:grid-cols-[1.1fr_1fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium uppercase tracking-widest text-slate-300 backdrop-blur-md">
              <span className="text-blue-300">Trustpilot</span>
              <span className="flex gap-0.5 text-yellow-400">
                {[0,1,2,3,4].map((i) => <Star key={i} className="h-3 w-3 fill-current" />)}
              </span>
              <span className="opacity-70">4.9 / 5 by NEET PG aspirants</span>
            </div>

            <h1 className="mt-6 text-[52px] leading-[1.02] tracking-tight md:text-[76px]" style={serif}>
              Study together,<br />
              <span className="italic bg-gradient-to-r from-blue-200 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
                stay in sync.
              </span>
            </h1>

            <p className="mt-6 max-w-lg text-base text-slate-400 md:text-lg">
              The collaborative MBBS study tracker built for two. Tick off topics together, race friendly streaks, and let an AI coach map your next move — all in real time.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/auth"
                className="group inline-flex items-center gap-2 rounded-full bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white shadow-[0_10px_40px_-10px_rgba(59,130,246,0.7)] transition hover:-translate-y-0.5 hover:bg-blue-500"
              >
                Start syncing free
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
              <a
                href="#features"
                className="rounded-full border border-white/10 bg-white/[0.03] px-6 py-3.5 text-sm font-semibold text-slate-200 backdrop-blur-md transition hover:bg-white/[0.06]"
              >
                See how it works
              </a>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-5 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> 19 MBBS subjects preloaded</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Realtime sync</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> AI study coach</span>
            </div>
          </div>

          {/* Glass hero card */}
          <div className="relative">
            {/* halo behind 3D */}
            <div className="pointer-events-none absolute -top-24 -right-8 h-64 w-64 rounded-full bg-blue-500/25 blur-3xl" />
            <img
              src={hero3dOrb}
              alt=""
              width={1024}
              height={1024}
              className="pointer-events-none absolute -top-16 -right-6 z-20 h-48 w-48 animate-float drop-shadow-[0_20px_50px_rgba(59,130,246,0.55)]"
            />

            <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.7)] backdrop-blur-2xl animate-float-slow">
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2.5">
                    <div className="grid h-10 w-10 place-items-center rounded-full border-2 border-[#050814] bg-gradient-to-br from-blue-500 to-indigo-600 text-[11px] font-bold">AB</div>
                    <div className="grid h-10 w-10 place-items-center rounded-full border-2 border-[#050814] bg-gradient-to-br from-pink-500 to-rose-500 text-[11px] font-bold">AI</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-slate-500">Study room</div>
                    <div className="text-sm font-semibold">Abhay &amp; Aishwarya</div>
                  </div>
                </div>
                <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-bold tracking-widest text-emerald-300">
                  LIVE
                </div>
              </div>

              <div className="space-y-3">
                {[
                  { s: "Anatomy · Thorax", a: 84, tag: "In progress" },
                  { s: "Physiology · CVS", a: 62, tag: "Reviewing" },
                  { s: "Pathology · Inflammation", a: 48, tag: "Just started" },
                ].map((r) => (
                  <div key={r.s} className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-200">{r.s}</span>
                      <span className="text-slate-500">{r.a}%</span>
                    </div>
                    <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-400 shadow-[0_0_10px_rgba(59,130,246,0.6)]"
                        style={{ width: `${r.a}%` }}
                      />
                    </div>
                    <div className="mt-2 text-[10px] uppercase tracking-widest text-slate-500">{r.tag}</div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-3">
                <div className="flex items-center gap-2 text-xs text-blue-200">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
                  Aishwarya just finished <span className="font-semibold">Brachial Plexus</span>
                </div>
                <button className="text-[11px] font-semibold text-blue-100 hover:text-white">Nudge ✨</button>
              </div>

              {/* subtle inner glow */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-blue-500/10 to-transparent" />
            </div>

            {/* floating badge chip */}
            <div className="absolute -bottom-6 left-6 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 shadow-xl backdrop-blur-md animate-float-slower">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-500/20 text-indigo-300">
                <Zap className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Streak</div>
                <div className="text-xs font-semibold">12 days 🔥</div>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section id="features" className="mt-32">
          <div className="mx-auto max-w-2xl text-center">
            <div className="text-[11px] font-semibold uppercase tracking-[0.25em] text-blue-300">Built for the marathon</div>
            <h2 className="mt-3 text-[38px] leading-[1.05] tracking-tight md:text-5xl" style={serif}>
              Everything two students need to <span className="italic bg-gradient-to-r from-blue-200 to-indigo-400 bg-clip-text text-transparent">finish strong.</span>
            </h2>
            <p className="mt-4 text-sm text-slate-400 md:text-base">
              Less app, more accountability. Built around the way you actually study.
            </p>
          </div>

          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {[
              { img: hero3dHeart, title: "Side-by-side progress", body: "See your partner's completed topics, streaks, and momentum in real time." },
              { img: hero3dOrb, title: "AI study coach", body: "Gemini-powered insights spot patterns and tell you exactly what to revise next." },
              { img: hero3dPill, title: "Smart nudges", body: "Poke each other, celebration pings on completions, and 5 daily motivation bumps." },
            ].map((f, i) => (
              <div
                key={f.title}
                className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl transition hover:-translate-y-1 hover:border-blue-400/30"
              >
                <div className="pointer-events-none absolute -top-16 right-0 h-40 w-40 rounded-full bg-blue-500/10 blur-3xl transition group-hover:bg-blue-500/25" />
                <div className="relative grid h-20 w-20 place-items-center">
                  <div className="absolute inset-0 rounded-2xl bg-blue-500/10 blur-xl" />
                  <img
                    src={f.img}
                    alt=""
                    width={512}
                    height={512}
                    loading="lazy"
                    className={`relative h-24 w-24 object-contain drop-shadow-[0_10px_30px_rgba(59,130,246,0.5)] ${i % 2 ? 'animate-float-slow' : 'animate-float'}`}
                  />
                </div>
                <h3 className="mt-8 text-lg font-semibold tracking-tight text-white" style={serif}>{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* PREVIEW */}
        <section id="preview" className="mt-28 overflow-hidden rounded-[36px] border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-8 backdrop-blur-2xl md:p-12">
          <div className="grid items-center gap-12 md:grid-cols-2">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-blue-300">Built for two</span>
              <h2 className="mt-3 text-3xl leading-tight tracking-tight md:text-4xl" style={serif}>
                One dashboard. <span className="italic text-blue-300">Both</span> your progress.
              </h2>
              <ul className="mt-7 space-y-3.5 text-sm">
                {[
                  { icon: Zap, label: "Realtime topic syncing across devices" },
                  { icon: LineChart, label: "Heatmaps, streaks, weekly analytics" },
                  { icon: Brain, label: "AI coach that reads your last 7 days" },
                  { icon: Bell, label: "Browser push, even when the tab is closed" },
                ].map((i) => (
                  <li key={i.label} className="flex items-center gap-3">
                    <span className="grid h-8 w-8 place-items-center rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-300">
                      <i.icon className="h-4 w-4" />
                    </span>
                    <span className="text-slate-300">{i.label}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl border border-white/10 bg-black/40 p-4">
              <div className="space-y-3">
                {[
                  { s: "Anatomy", a: 72, b: 58 },
                  { s: "Physiology", a: 64, b: 70 },
                  { s: "Pathology", a: 48, b: 55 },
                  { s: "Pharmacology", a: 30, b: 42 },
                ].map((r) => (
                  <div key={r.s} className="rounded-2xl border border-white/5 bg-white/[0.03] p-3.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-200">{r.s}</span>
                      <span className="text-slate-500">Abhay {r.a}% · Aishwarya {r.b}%</span>
                    </div>
                    <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400" style={{ width: `${r.a}%` }} />
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full bg-gradient-to-r from-pink-500 to-rose-400" style={{ width: `${r.b}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section id="coach" className="relative mt-28 overflow-hidden rounded-[40px] border border-blue-500/20 bg-gradient-to-b from-blue-600/15 via-blue-600/5 to-transparent p-12 text-center md:p-16">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.25),transparent_60%)]" />
          <img
            src={hero3dOrb}
            alt=""
            width={512}
            height={512}
            loading="lazy"
            className="pointer-events-none mx-auto mb-6 h-32 w-32 animate-float drop-shadow-[0_20px_60px_rgba(59,130,246,0.7)]"
          />
          <h2 className="relative text-4xl leading-[1.05] tracking-tight md:text-6xl" style={serif}>
            Ready to <span className="italic bg-gradient-to-r from-blue-200 to-indigo-400 bg-clip-text text-transparent">stay in sync?</span>
          </h2>
          <p className="relative mx-auto mt-4 max-w-lg text-sm text-slate-400 md:text-base">
            Sign up free, invite your study partner by email, and start ticking topics together today.
          </p>
          <Link
            to="/auth"
            className="relative mt-8 inline-flex items-center gap-2 rounded-full bg-white px-7 py-4 text-sm font-semibold text-slate-950 shadow-[0_20px_60px_-15px_rgba(255,255,255,0.4)] transition hover:-translate-y-0.5 active:scale-95"
          >
            Create your study room
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/5 py-8 text-center text-xs text-slate-600">
        Made with care for medical students everywhere.
      </footer>

      <style>{`
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-14px)} }
        @keyframes float-slow { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes float-slower { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes orb-a { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(30px,-20px) scale(1.05)} }
        @keyframes orb-b { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-40px,20px) scale(1.08)} }
        .animate-float { animation: float 6s ease-in-out infinite; }
        .animate-float-slow { animation: float-slow 8s ease-in-out infinite; }
        .animate-float-slower { animation: float-slower 9s ease-in-out infinite; }
        .animate-orb-a { animation: orb-a 18s ease-in-out infinite; }
        .animate-orb-b { animation: orb-b 22s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
