import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sparkles, Loader2 } from "lucide-react";
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
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-aurora opacity-30 blur-3xl" />
      </div>
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
        <Link to="/" className="mb-8 flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-primary text-white shadow-glow">
            <Sparkles className="h-5 w-5" />
          </div>
          <span className="font-display text-lg font-semibold tracking-tight">Let's be in sync</span>
        </Link>

        <div className="rounded-2xl border border-border bg-card/70 p-6 shadow-card backdrop-blur animate-scale-in">
          <h1 className="font-display text-2xl font-bold">Welcome</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in or create your account to start syncing.</p>

          <Tabs defaultValue="signin" className="mt-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Sign up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="mt-4 space-y-4">
                <div>
                  <Label htmlFor="si-email">Email</Label>
                  <Input id="si-email" type="email" value={signinEmail} onChange={(e) => setSigninEmail(e.target.value)} required />
                </div>
                <div>
                  <Label htmlFor="si-pass">Password</Label>
                  <Input id="si-pass" type="password" value={signinPassword} onChange={(e) => setSigninPassword(e.target.value)} required />
                </div>
                <Button type="submit" disabled={submitting} className="w-full bg-gradient-primary text-white shadow-glow hover:opacity-95">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="mt-4 space-y-4">
                <div>
                  <Label htmlFor="su-name">Name</Label>
                  <Input
                    id="su-name"
                    placeholder="Abhay or Aishwarya"
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="su-email">Email</Label>
                  <Input id="su-email" type="email" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} required />
                </div>
                <div>
                  <Label htmlFor="su-pass">Password (min 6 chars)</Label>
                  <Input
                    id="su-pass"
                    type="password"
                    minLength={6}
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" disabled={submitting} className="w-full bg-gradient-primary text-white shadow-glow hover:opacity-95">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
