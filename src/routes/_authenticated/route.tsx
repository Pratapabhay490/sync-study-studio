import { createFileRoute, Outlet, redirect, useNavigate, Link, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useData } from "@/lib/data-context";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import {
  Activity, BarChart3, BookOpen, Brain, LayoutDashboard, ListChecks, LogOut, Menu, Moon, Settings, Sparkles, Sun, Trophy, X,
} from "lucide-react";
import { useState } from "react";
import { useTheme } from "@/lib/theme-provider";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { NotificationCenter } from "@/components/notification-center";
import { AnimatePresence, motion } from "framer-motion";
import { useAutoReveal } from "@/lib/use-auto-reveal";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/subjects", label: "Subjects", icon: BookOpen },
  { to: "/daily-board", label: "Daily Board", icon: ListChecks },
  { to: "/practice", label: "AI Practice", icon: Brain },
  { to: "/practice-stats", label: "Quiz Stats", icon: Trophy },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/activity", label: "Activity", icon: Activity },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function AuthenticatedLayout() {
  const { user, signOut } = useAuth();
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
    <div className="min-h-screen">
      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex items-center justify-between px-4 py-3 md:hidden">
        <div className="clay flex w-full items-center justify-between px-4 py-2">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-primary text-white shadow-clay-sm"><Sparkles className="h-4 w-4" /></div>
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

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`${
            open ? "translate-x-0" : "-translate-x-full"
          } fixed inset-y-0 left-0 z-50 w-72 transform p-4 transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0`}
        >
          <div className="clay flex h-full flex-col p-4">
            <Link to="/dashboard" className="mb-6 hidden items-center gap-2.5 px-2 md:flex">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-primary text-white shadow-clay-sm"><Sparkles className="h-5 w-5" /></div>
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
              <div className="clay-pressed p-3">
                <div className="flex items-center gap-3">
                  <UserAvatar profile={me} size={40} />
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
            </div>
          </div>
        </aside>

        {open && <div className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm md:hidden" onClick={() => setOpen(false)} />}

        <main className="min-h-screen flex-1 px-4 py-4 md:px-8 md:py-8">
          <div className="mx-auto max-w-7xl">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={pathname}
                initial={{ opacity: 0, scale: 0.96, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: -4 }}
                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                style={{ transformOrigin: "var(--page-origin-x, 50%) var(--page-origin-y, 30%)" }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}
