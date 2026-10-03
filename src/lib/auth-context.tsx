import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const GUEST_STORAGE_KEY = "syncstudy-guest";

/**
 * Synthetic user presented while someone explores as a guest. The id is a
 * sentinel — it is never written to the database (guest writes are gated),
 * so every user-scoped query simply resolves empty.
 */
const GUEST_USER = {
  id: "guest",
  email: "",
  user_metadata: { name: "Guest" },
} as unknown as User;

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    name: string
  ) => Promise<{ error: string | null; needsVerification: boolean }>;
  resendVerificationEmail: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  isGuest: boolean;
  enterGuestMode: () => void;
  exitGuestMode: () => void;
  signupPromptOpen: boolean;
  openSignupPrompt: () => void;
  closeSignupPrompt: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(
    () => typeof window !== "undefined" && window.localStorage.getItem(GUEST_STORAGE_KEY) === "1",
  );
  const [signupPromptOpen, setSignupPromptOpen] = useState(false);

  useEffect(() => {
    // Any real session ends guest mode — this also covers the email
    // verification link opening the app (session appears with no sign-in call).
    const endGuest = () => {
      window.localStorage.removeItem(GUEST_STORAGE_KEY);
      setIsGuest(false);
    };
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s) endGuest();
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) endGuest();
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const enterGuestMode = useCallback(() => {
    window.localStorage.setItem(GUEST_STORAGE_KEY, "1");
    setIsGuest(true);
  }, []);

  const exitGuestMode = useCallback(() => {
    window.localStorage.removeItem(GUEST_STORAGE_KEY);
    setIsGuest(false);
  }, []);

  const openSignupPrompt = useCallback(() => setSignupPromptOpen(true), []);
  const closeSignupPrompt = useCallback(() => setSignupPromptOpen(false), []);

  const clearGuest = useCallback(() => {
    window.localStorage.removeItem(GUEST_STORAGE_KEY);
    setIsGuest(false);
  }, []);

  const value: AuthContextValue = {
    user: session?.user ?? (isGuest ? GUEST_USER : null),
    session,
    loading,
    async signIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (!error) clearGuest();
      return { error: error?.message ?? null };
    },
    async signUp(email, password, name) {
      const redirectUrl = `${window.location.origin}/dashboard`;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name }, emailRedirectTo: redirectUrl },
      });
      // Email confirmation is enabled: a fresh signup returns a user but no
      // session until the email link is clicked.
      const needsVerification = !error && !data.session;
      // A fully-created session ends guest mode; a pending verification keeps
      // the user exploring as a guest until they verify and sign in.
      if (!error && !needsVerification) clearGuest();
      return { error: error?.message ?? null, needsVerification };
    },
    async resendVerificationEmail(email) {
      const { error } = await supabase.auth.resend({ type: "signup", email });
      return { error: error?.message ?? null };
    },
    async signOut() {
      await supabase.auth.signOut();
    },
    isGuest,
    enterGuestMode,
    exitGuestMode,
    signupPromptOpen,
    openSignupPrompt,
    closeSignupPrompt,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
