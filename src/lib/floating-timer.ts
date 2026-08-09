import { useCallback, useEffect, useState } from "react";

const KEY = "floating-timer-enabled";

export type FloatSupport = "document-pip" | "video-pip" | "unsupported";

/** What kind of floating window (if any) this browser can give us. */
export function detectFloatSupport(): FloatSupport {
  if (typeof window === "undefined") return "unsupported";
  if ((window as any).documentPictureInPicture?.requestWindow) return "document-pip";
  if (typeof document === "undefined") return "unsupported";
  const v = document.createElement("video") as any;
  const iosStandalone =
    (window.navigator as any).standalone === true &&
    /iPad|iPhone|iPod/.test(navigator.userAgent);
  // iOS home-screen apps do not expose Picture-in-Picture at all.
  if (iosStandalone && !v.webkitSetPresentationMode) return "unsupported";
  if ((document as any).pictureInPictureEnabled) return "video-pip";
  if (v.webkitSetPresentationMode) return "video-pip";
  return "unsupported";
}

/** Persisted user preference for the floating focus timer (null = never asked). */
export function useFloatingTimerPref() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [support, setSupport] = useState<FloatSupport>("unsupported");

  useEffect(() => {
    setSupport(detectFloatSupport());
    try {
      const raw = localStorage.getItem(KEY);
      setEnabled(raw === null ? null : raw === "true");
    } catch {
      setEnabled(null);
    }
  }, []);

  const set = useCallback((value: boolean) => {
    setEnabled(value);
    try {
      localStorage.setItem(KEY, String(value));
    } catch {
      /* ignore */
    }
    try {
      window.dispatchEvent(new CustomEvent("floating-timer-pref", { detail: value }));
    } catch {
      /* ignore */
    }
  }, []);

  // keep multiple mounted consumers in sync
  useEffect(() => {
    const onPref = (e: Event) => setEnabled((e as CustomEvent).detail as boolean);
    window.addEventListener("floating-timer-pref", onPref as EventListener);
    return () => window.removeEventListener("floating-timer-pref", onPref as EventListener);
  }, []);

  return { enabled, setEnabled: set, support, asked: enabled !== null };
}
