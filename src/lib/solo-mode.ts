import { useCallback, useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

// Shared in-memory store so every component sees the same solo-mode value.
let value = false;
let loadedFor: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useSoloMode() {
  const { user } = useAuth();
  const solo = useSyncExternalStore(subscribe, () => value, () => false);

  useEffect(() => {
    if (!user || loadedFor === user.id) return;
    loadedFor = user.id;
    supabase
      .from("profiles")
      .select("solo_mode")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        value = Boolean((data as { solo_mode?: boolean } | null)?.solo_mode);
        emit();
      });
  }, [user]);

  const setSolo = useCallback(
    async (next: boolean) => {
      if (!user) return { error: "Not signed in" };
      const prev = value;
      value = next;
      emit();
      const { error } = await supabase.from("profiles").update({ solo_mode: next } as never).eq("id", user.id);
      if (error) {
        value = prev;
        emit();
        return { error: error.message };
      }
      return { error: null };
    },
    [user],
  );

  return { solo, setSolo };
}
