import { createFileRoute, Outlet, redirect, useNavigate, Link, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useData } from "@/lib/data-context";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import {
  Activity, BarChart3, BookOpen, LayoutDashboard, LogOut, Menu, Moon, Settings, Sparkles, Sun, X,
} from "lucide-react";
import { useState } from "react";
import { useTheme } from "@/lib/theme-provider";
import { supabase } from "@/integrations/supabase/client";

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

  const me = profiles.find((p) => p.id === user?.id);

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur md:hidden">
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-primary text-white"><Sparkles className="h-4 w-4" /></div>
          <span className="font-display font-semibold">in sync</span>
        </Link>
        <button onClick={() => setOpen((o) => !o)} className="rounded-lg border border-border p-2" aria-label="Toggle menu">
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`${
            open ? "translate-x-0" : "-translate-x-full"
          } fixed inset-y-0 left-0 z-50 w-72 transform border-r border-border bg-sidebar transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0`}
        >
          <div className="flex h-full flex-col p-4">
            <Link to="/dashboard" className="mb-6 hidden items-center gap-2 px-2 md:flex">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-primary text-white shadow-glow"><Sparkles className="h-5 w-5" /></div>
              <div>
                <div className="font-display text-base font-semibold leading-tight">Let's be</div>
                <div className="font-display text-base font-semibold leading-tight text-gradient">in sync</div>
              </div>
            </Link>

            <nav className="flex flex-col gap-1">
              {nav.map((item) => {
                const active = pathname === item.to || pathname.startsWith(item.to + "/");
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                      active
                        ? "bg-gradient-primary text-white shadow-glow"
                        : "text-sidebar-foreground hover:bg-sidebar-accent"
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-auto space-y-3">
              <div className="rounded-2xl border border-sidebar-border bg-card/60 p-3">
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

        {open && <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setOpen(false)} />}

        <main className="min-h-screen flex-1 px-4 py-6 md:px-8 md:py-10">
          <div className="mx-auto max-w-7xl animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
