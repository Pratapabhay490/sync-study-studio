import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sparkles, Loader2, Mail, Lock, User } from "lucide-react";
import clayAuthHero from "@/assets/clay-auth-hero.png";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Let's be in sync" },
      { name: "description", content: "Sign in or create your account to start tracking MBBS progress together." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { signIn, signUp, user, loading } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

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
    if (error) toast.error(error);
    else {
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
    const { error } = await signUp(signupEmail, signupPassword, signupName);
    setSubmitting(false);
    if (error) toast.error(error);
    else {
      toast.success("Account created. You're in!");
      navigate({ to: "/dashboard" });
    }
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
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-primary text-white shadow-clay-sm">
            <Sparkles className="h-6 w-6" />
          </div>
          <span className="font-display text-xl font-bold tracking-tight">Let's be in sync</span>
        </Link>

        <div className="clay p-8 pt-0 animate-scale-in">
          <div className="-mt-20 mb-2 flex justify-center">
            <img
              src={clayAuthHero}
              alt="Two clay-style medical students studying together"
              width={1024}
              height={1024}
              className="h-40 w-40 animate-float-slow drop-shadow-xl"
            />
          </div>
          <div className="text-center">
            <h1 className="font-display text-3xl font-bold tracking-tight">Welcome back</h1>
            <p className="mt-2 text-sm text-muted-foreground">Sign in to sync your study journey</p>
          </div>

          <Tabs defaultValue="signin" className="mt-6">
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
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
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
