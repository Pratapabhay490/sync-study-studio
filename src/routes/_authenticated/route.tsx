import { createFileRoute, Outlet, redirect, useNavigate, Link, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useData } from "@/lib/data-context";
import { LivingAvatar } from "@/components/living-avatar";
import { MascotProvider } from "@/components/study-mascot/mascot-brain";
import { Button } from "@/components/ui/button";
import {
  Activity, BarChart3, BookOpen, Brain, Home, LayoutDashboard, LogOut, Map, Menu, Moon, Settings, Sun, Trophy, X,
} from "lucide-react";
import { useState } from "react";
import { useTheme } from "@/lib/theme-provider";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { NotificationCenter } from "@/components/notification-center";
import { SignupPromptModal } from "@/components/signup-prompt-modal";
import { AnimatePresence, motion } from "framer-motion";
import { useAutoReveal } from "@/lib/use-auto-reveal";
import syncLogo from "@/assets/sync-logo.webp";


export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    // Guests explore with a synthetic local user (see auth-context); only
    // bounce to /auth when there is neither a session nor guest mode.
    const isGuest =
      typeof window !== "undefined" && window.localStorage.getItem("syncstudy-guest") === "1";
    if ((error || !data.user) && !isGuest) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

const nav = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/home", label: "Overview", icon: LayoutDashboard },
  { to: "/journey", label: "Journey", icon: Map },
  { to: "/subjects", label: "Subjects", icon: BookOpen },
  { to: "/practice", label: "AI Practice", icon: Brain },
  { to: "/practice-stats", label: "Quiz Stats", icon: Trophy },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/activity", label: "Activity", icon: Activity },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function AuthenticatedLayout() {
  const { user, signOut, isGuest, exitGuestMode } = useAuth();
  const { profiles } = useData();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  useAutoReveal(pathname);

  const me = profiles.find((p) => p.id === user?.id);

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <MascotProvider>
    <div className="min-h-screen">
      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex items-center justify-between px-4 py-3 md:hidden">
        <div className="clay flex w-full items-center justify-between px-4 py-2">
          <Link to="/dashboard" className="flex items-center gap-2">
            <img src={syncLogo} alt="in sync" className="logo-breathe h-9 w-9 rounded-xl object-cover shadow-clay-sm" loading="eager" decoding="async" />
            <span className="font-display font-bold">in sync</span>
          </Link>
          <div className="flex items-center gap-2">
            <NotificationCenter />
            <button onClick={() => setOpen((o) => !o)} className="grid h-10 w-10 place-items-center rounded-xl bg-card text-foreground shadow-clay-sm active:scale-95" aria-label="Toggle menu">
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
      {/* Desktop floating notification bell */}
      <div className="pointer-events-none fixed right-6 top-6 z-40 hidden md:block">
        <div className="pointer-events-auto"><NotificationCenter /></div>
      </div>

      <div className="flex min-w-0">
        {/* Sidebar */}
        <aside
          className={`${
            open ? "translate-x-0" : "-translate-x-full"
          } fixed inset-y-0 left-0 z-50 w-72 transform p-4 transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0`}
        >
          <div className="clay flex h-full flex-col p-4">
            <Link to="/dashboard" className="mb-6 hidden items-center gap-2.5 px-2 md:flex">
              <img src={syncLogo} alt="in sync" className="logo-breathe h-11 w-11 rounded-2xl object-cover shadow-clay-sm" loading="lazy" decoding="async" />
              <div>
                <div className="font-display text-base font-bold leading-tight">Let's be</div>
                <div className="font-display text-base font-bold leading-tight text-gradient">in sync</div>
              </div>
            </Link>

            <nav className="flex flex-col gap-2">
              {nav.map((item) => {
                const active = pathname === item.to || pathname.startsWith(item.to + "/");
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => {
                      document.documentElement.style.setProperty("--page-origin-x", "50%");
                      document.documentElement.style.setProperty("--page-origin-y", "30%");
                      setOpen(false);
                    }}
                    className={cn(
                      "group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-all",
                      active
                        ? "bg-gradient-primary text-white shadow-clay-sm"
                        : "text-foreground/70 hover:text-foreground hover:-translate-y-0.5 hover:shadow-clay-sm hover:bg-card",
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-auto">
              {isGuest ? (
                <div className="clay-pressed p-3 text-center">
                  <div className="text-sm font-semibold">Exploring as guest</div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Sign in to save progress and sync with a partner.
                  </p>
                  <Button
                    size="sm"
                    className="mt-3 w-full bg-gradient-primary text-white"
                    onClick={() => {
                      exitGuestMode();
                      navigate({ to: "/auth", search: { tab: "signin" } });
                    }}
                  >
                    Sign in
                  </Button>
                </div>
              ) : (
              <div className="clay-pressed p-3">
                <div className="flex items-center gap-3">
                  <LivingAvatar profile={me} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{me?.name ?? "You"}</div>
                    <div className="truncate text-xs text-muted-foreground">{me?.email}</div>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={toggle}>
                    {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={handleSignOut}>
                    <LogOut className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              )}
            </div>
          </div>
        </aside>

        {open && <div className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm md:hidden" onClick={() => setOpen(false)} />}

        <main className="min-h-screen min-w-0 flex-1 overflow-x-clip px-4 py-4 md:px-8 md:py-8">
          <div className="mx-auto min-w-0 max-w-7xl">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                style={{ transformOrigin: "var(--page-origin-x, 50%) var(--page-origin-y, 30%)" }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
      <SignupPromptModal />
    </div>
    </MascotProvider>
  );
}
