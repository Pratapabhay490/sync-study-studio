import { useCallback, useEffect, useState } from "react";

const KEY = "floating-timer-enabled";

export type FloatSupport = "document-pip" | "video-pip" | "unsupported";

/** True when running as an iOS/iPadOS home-screen app (Safari standalone). */
export function isIosStandalone(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const isApple =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1);
  const standalone =
    (window.navigator as any).standalone === true ||
    window.matchMedia?.("(display-mode: standalone)").matches === true;
  return isApple && standalone;
}

/** What kind of floating window (if any) this browser can give us. */
export function detectFloatSupport(): FloatSupport {
  if (typeof window === "undefined") return "unsupported";
  if ((window as any).documentPictureInPicture?.requestWindow) return "document-pip";
  if (typeof document === "undefined") return "unsupported";
  const v = document.createElement("video") as any;
  // iPhone home-screen apps do not expose Picture-in-Picture; iPad often still does.
  if (isIosStandalone() && !v.webkitSetPresentationMode && !(document as any).pictureInPictureEnabled)
    return "unsupported";
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
