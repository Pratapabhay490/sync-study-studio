import { useNavigate } from "@tanstack/react-router";
import { UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

/**
 * Conversion prompt shown to guests when they try to do something that
 * needs an account (ticking a topic, adding subjects, starting a quiz…).
 * Rendered once inside the authenticated layout.
 */
export function SignupPromptModal() {
  const { signupPromptOpen, closeSignupPrompt, exitGuestMode } = useAuth();
  const navigate = useNavigate();

  if (!signupPromptOpen) return null;

  const go = (tab: "signin" | "signup") => {
    closeSignupPrompt();
    exitGuestMode();
    navigate({ to: "/auth", search: { tab } });
  };

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-foreground/40 p-6 backdrop-blur-sm"
      onClick={closeSignupPrompt}
      role="dialog"
      aria-modal="true"
      aria-label="Sign up to continue"
    >
      <div
        className="clay animate-scale-in w-full max-w-sm p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-primary text-white shadow-clay-sm">
          <UserPlus className="h-7 w-7" />
        </div>
        <h2 className="mt-4 font-display text-2xl font-bold tracking-tight">Want to track this?</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          You&apos;re exploring as a guest. Sign up free to tick topics, sync with a
          study partner, and build your streak.
        </p>
        <div className="mt-5 space-y-2.5">
          <Button size="lg" className="w-full bg-gradient-primary text-white" onClick={() => go("signup")}>
            Sign up free
          </Button>
          <Button size="lg" variant="outline" className="w-full" onClick={() => go("signin")}>
            I already have an account
          </Button>
        </div>
        <button
          type="button"
          onClick={closeSignupPrompt}
          className="mt-4 inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" /> Keep exploring
        </button>
      </div>
    </div>
  );
}
