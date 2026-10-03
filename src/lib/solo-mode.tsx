import { useCallback, useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

// Shared in-memory store so every component sees the same solo-mode value.
// The last known value is cached per user so reloads don't flash partner prompts.
let value = false;
let loadedFor: string | null = null;
let loadingFor: string | null = null;
let writeVersion = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const cacheKey = (id: string) => `syncstudy-solo-${id}`;
const readCache = (id: string) => {
  try { return window.localStorage.getItem(cacheKey(id)) === "1"; } catch { return false; }
};
const writeCache = (id: string, v: boolean) => {
  try { window.localStorage.setItem(cacheKey(id), v ? "1" : "0"); } catch { /* ignore */ }
};

async function load(userId: string, attempt = 0): Promise<void> {
  if (loadingFor === userId) return;
  loadingFor = userId;
  const version = writeVersion;
  const { data, error } = await supabase
    .from("profiles")
    .select("solo_mode")
    .eq("id", userId)
    .maybeSingle();
  loadingFor = null;
  if (loadedFor !== userId && loadedFor !== null && loadedFor !== `pending:${userId}`) return;
  if (error || !data) {
    // Keep the cached value and retry with backoff instead of silently turning solo off.
    if (attempt < 4) setTimeout(() => load(userId, attempt + 1), 1000 * 2 ** attempt);
    return;
  }
  if (version !== writeVersion) return; // a newer local change wins
  loadedFor = userId;
  value = Boolean((data as { solo_mode?: boolean }).solo_mode);
  writeCache(userId, value);
  emit();
}

export function useSoloMode() {
  const { user } = useAuth();
  const solo = useSyncExternalStore(subscribe, () => value, () => false);

  useEffect(() => {
    if (!user) {
      loadedFor = null;
      if (value) { value = false; emit(); }
      return;
    }
    if (user.id === "guest" || loadedFor === user.id || loadedFor === `pending:${user.id}`) return;
    loadedFor = `pending:${user.id}`;
    value = readCache(user.id);
    emit();
    load(user.id);
  }, [user]);

  const setSolo = useCallback(
    async (next: boolean) => {
      if (!user) return { error: "Not signed in" };
      const prev = value;
      writeVersion++;
      value = next;
      emit();
      const { error } = await supabase.from("profiles").update({ solo_mode: next } as never).eq("id", user.id);
      if (error) {
        value = prev;
        emit();
        return { error: error.message };
      }
      writeCache(user.id, next);
      return { error: null };
    },
    [user],
  );

  return { solo, setSolo };
}

/** Renders children only when the user has NOT turned on solo mode. */
export function HideInSolo({ children }: { children: React.ReactNode }) {
  const { solo } = useSoloMode();
  return solo ? null : children;
}
