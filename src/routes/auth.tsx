import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Mail, MailCheck, Lock, User } from "lucide-react";
import syncLogo from "@/assets/sync-logo.webp";
import clayAuthHero from "@/assets/clay-auth-hero.webp";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { tab?: "signin" | "signup" } => ({
    tab: search.tab === "signup" || search.tab === "signin" ? search.tab : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — Let's be in sync" },
      { name: "description", content: "Sign in or create your account to start tracking MBBS progress together." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { signIn, signUp, resendVerificationEmail, user, loading, isGuest, enterGuestMode } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState(search.tab === "signup" ? "signup" : "signin");
  // Set when signup succeeded but the email still needs verification.
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    // Guests land here deliberately (e.g. from the profile signup nudge) —
    // don't bounce them straight back into the app.
    if (!loading && user && !isGuest) navigate({ to: "/dashboard" });
  }, [user, loading, isGuest, navigate]);

  function handleGuest() {
    enterGuestMode();
    navigate({ to: "/dashboard" });
  }

  const [signinEmail, setSigninEmail] = useState("");
  const [signinPassword, setSigninPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await signIn(signinEmail, signinPassword);
    setSubmitting(false);
    if (error) {
      toast.error(
        /not confirmed/i.test(error)
          ? "Your email isn't verified yet — open your inbox, click the verification link, then sign in."
          : error
      );
    } else {
      toast.success("Welcome back!");
      navigate({ to: "/dashboard" });
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (signupPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setSubmitting(true);
    const { error, needsVerification } = await signUp(signupEmail, signupPassword, signupName);
    setSubmitting(false);
    if (error) toast.error(error);
    else if (needsVerification) setPendingEmail(signupEmail);
    else {
      toast.success("Account created. You're in!");
      navigate({ to: "/dashboard" });
    }
  }

  async function handleResend() {
    if (!pendingEmail) return;
    setResending(true);
    const { error } = await resendVerificationEmail(pendingEmail);
    setResending(false);
    if (error) toast.error(error);
    else toast.success("Verification email sent — check your inbox.");
  }

  function backToSignIn() {
    if (pendingEmail) setSigninEmail(pendingEmail);
    setPendingEmail(null);
    setTab("signin");
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Soft floating blobs */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-gradient-aurora opacity-40 blur-3xl animate-float-slow" />
        <div className="absolute bottom-0 right-10 h-80 w-80 rounded-full bg-gradient-primary opacity-25 blur-3xl" />
        <div className="absolute top-1/3 right-1/4 h-40 w-40 rounded-full bg-gradient-aishwarya opacity-30 blur-2xl" />
      </div>

      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <img src={syncLogo} alt="SyncStudy" className="logo-breathe h-12 w-12 rounded-2xl object-cover shadow-clay-sm" loading="eager" decoding="async" />
          <span className="font-display text-xl font-bold tracking-tight">Let's be in sync</span>
        </Link>

        <div className="clay p-8 pt-0 animate-scale-in">
          <div className="-mt-20 mb-2 flex justify-center">
            <img
              src={clayAuthHero}
              alt="Two clay-style medical students studying together"
              width={1024}
              height={1024}
              className="h-40 w-40 animate-float-slow drop-shadow-xl" loading="eager" fetchPriority="high" decoding="async" />
          </div>
          <div className="text-center">
            <h1 className="font-display text-3xl font-bold tracking-tight">Welcome back</h1>
            <p className="mt-2 text-sm text-muted-foreground">Sign in to sync your study journey</p>
          </div>

          {pendingEmail ? (
            <div className="mt-6 space-y-4 text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-primary text-white shadow-clay-sm">
                <MailCheck className="h-7 w-7" />
              </div>
              <div>
                <h2 className="font-display text-2xl font-bold tracking-tight">Check your inbox</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  We sent a verification link to{" "}
                  <span className="font-semibold text-foreground">{pendingEmail}</span>.
                  Click the link in that email, then sign in to start studying.
                </p>
              </div>
              <Button onClick={handleResend} disabled={resending} size="lg" className="w-full">
                {resending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Resend verification email"}
              </Button>
              <div>
                <button
                  type="button"
                  onClick={backToSignIn}
                  className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  Back to sign in
                </button>
              </div>
            </div>
          ) : (
            <Tabs value={tab} onValueChange={setTab} className="mt-6">
              <TabsList className="grid w-full grid-cols-2 rounded-full bg-input p-1.5 shadow-clay-inset">
                <TabsTrigger value="signin" className="rounded-full data-[state=active]:bg-card data-[state=active]:shadow-clay-sm">Sign in</TabsTrigger>
                <TabsTrigger value="signup" className="rounded-full data-[state=active]:bg-card data-[state=active]:shadow-clay-sm">Sign up</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="mt-6 space-y-4">
                  <FieldWithIcon icon={Mail}>
                    <Input id="si-email" type="email" placeholder="Enter your email" className="pl-12" value={signinEmail} onChange={(e) => setSigninEmail(e.target.value)} required />
                  </FieldWithIcon>
                  <FieldWithIcon icon={Lock}>
                    <Input id="si-pass" type="password" placeholder="Enter your password" className="pl-12" value={signinPassword} onChange={(e) => setSigninPassword(e.target.value)} required />
                  </FieldWithIcon>
                  <Button type="submit" disabled={submitting} size="lg" className="mt-2 w-full">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="mt-6 space-y-4">
                  <FieldWithIcon icon={User}>
                    <Input id="su-name" placeholder="Your name" className="pl-12" value={signupName} onChange={(e) => setSignupName(e.target.value)} required />
                  </FieldWithIcon>
                  <FieldWithIcon icon={Mail}>
                    <Input id="su-email" type="email" placeholder="Enter your email" className="pl-12" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} required />
                  </FieldWithIcon>
                  <FieldWithIcon icon={Lock}>
                    <Input id="su-pass" type="password" placeholder="Create a password (min 6)" minLength={6} className="pl-12" value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} required />
                  </FieldWithIcon>
                  <Button type="submit" disabled={submitting} size="lg" className="mt-2 w-full">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          )}
        </div>

        {/* Friction-free first look: explore with a sample catalogue, no account. */}
        {!pendingEmail && (
          <div className="mt-6">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              or
              <div className="h-px flex-1 bg-border" />
            </div>
            <button
              type="button"
              onClick={handleGuest}
              className="clay mt-4 w-full rounded-2xl border-0 px-6 py-3.5 text-sm font-semibold transition hover:-translate-y-0.5"
            >
              Explore as guest
            </button>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              No account needed — sign up anytime to save your progress.
            </p>
          </div>
        )}

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Two minds. One rhythm. Built for study duos who thrive together.
        </p>
      </div>
    </div>
  );
}

function FieldWithIcon({ icon: Icon, children }: { icon: typeof Mail; children: React.ReactNode }) {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute left-3 top-1/2 z-10 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg bg-gradient-primary text-white shadow-clay-sm">
        <Icon className="h-3.5 w-3.5" />
      </div>
      {children}
    </div>
  );
}

// Hidden label component (unused but kept for a11y reference)
export const _Label = Label;
