import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PictureInPicture2, Timer, X, PartyPopper } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useActiveFocusSession } from "@/lib/partner";
import { celebrate } from "@/lib/celebrate";
import { playChime, primeAudio } from "@/lib/chime";
import { useFloatingTimerPref, isIosStandalone } from "@/lib/floating-timer";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function fmt(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/**
 * Global floating focus timer:
 *  - a draggable clay pill that stays on top of every page while a session runs
 *  - a real Picture-in-Picture window so the countdown stays visible when the app is minimised
 *  - tab-title countdown fallback
 *  - a cute celebration when the timer hits zero
 */
export function FocusOverlay() {
  const { user } = useAuth();
  const userIds = useMemo(() => (user ? [user.id] : []), [user?.id]);
  const session = useActiveFocusSession(userIds);
  const { enabled: floatEnabled, setEnabled: setFloatEnabled, support: floatSupport } =
    useFloatingTimerPref();
  const [now, setNow] = useState(() => Date.now());
  const [hidden, setHidden] = useState(false);
  const [done, setDone] = useState(false);
  const pipRef = useRef<Window | null>(null);
  const pipNodesRef = useRef<{ time: HTMLElement; bar: HTMLElement; label: HTMLElement } | null>(null);
  const lastSessionId = useRef<string | null>(null);
  const titleRef = useRef<string>("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const paintTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);


  // wall-clock aligned tick
  useEffect(() => {
    if (!session) return;
    let t: ReturnType<typeof setTimeout>;
    const loop = () => {
      const ms = Date.now();
      setNow(ms);
      t = setTimeout(loop, 1000 - (ms % 1000));
    };
    loop();
    const onVis = () => document.visibilityState === "visible" && setNow(Date.now());
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearTimeout(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [session?.id]);

  useEffect(() => {
    if (session?.id && session.id !== lastSessionId.current) {
      lastSessionId.current = session.id;
      setHidden(false);
      setDone(false);
    }
  }, [session?.id]);

  const remaining = session
    ? Math.max(0, Math.round((new Date(session.ends_at).getTime() - now) / 1000))
    : 0;
  const total = session ? session.duration_min * 60 : 0;
  const pct = total ? Math.min(100, Math.max(0, ((total - remaining) / total) * 100)) : 0;

  // finish detection
  useEffect(() => {
    if (!session || remaining > 0) return;
    if (done) return;
    setDone(true);
    setHidden(false);
    playChime();
    celebrate(0.5, 0.4);
    setTimeout(() => celebrate(0.25, 0.5), 300);
    setTimeout(() => celebrate(0.75, 0.5), 600);
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification("Focus session complete 🎉", {
          body: "Time's up — stretch, hydrate, and log what you covered.",
          icon: "/icon-192.png",
        });
      }
    } catch {
      /* ignore */
    }
    closePip();
  }, [remaining, session?.id, done]);

  // tab title countdown
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!titleRef.current) titleRef.current = document.title;
    if (session && remaining > 0) document.title = `⏳ ${fmt(remaining)} · focus`;
    else document.title = titleRef.current;
  }, [remaining, session?.id]);

  // keep the PiP window in sync
  useEffect(() => {
    const nodes = pipNodesRef.current;
    if (!nodes) return;
    nodes.time.textContent = fmt(remaining);
    nodes.bar.style.width = `${pct}%`;
    if (remaining <= 0) nodes.label.textContent = "Session complete 🎉";
  }, [remaining, pct]);

  // live values for the canvas painter
  const frameRef = useRef({ remaining: 0, pct: 0 });
  frameRef.current = { remaining, pct };

  function closePip() {
    try {
      pipRef.current?.close();
    } catch {
      /* ignore */
    }
    pipRef.current = null;
    pipNodesRef.current = null;
    stopVideoPip();
  }

  useEffect(() => () => closePip(), []);

  // Pre-warm the canvas stream while a session runs so the pop-out tap
  // (which must stay inside the user gesture on Safari) is instant.
  useEffect(() => {
    if (!session || remaining <= 0) return;
    const c = canvasRef.current;
    const v = videoRef.current as any;
    if (!c || !v) return;
    paint();
    if (!v.srcObject) {
      const stream = (c as any).captureStream?.(12);
      if (!stream) return;
      v.srcObject = stream;
    }
    if (!paintTimerRef.current) paintTimerRef.current = setInterval(paint, 500);
    v.muted = true;
    v.playsInline = true;
    v.play?.().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, remaining > 0]);

  function stopVideoPip() {
    if (paintTimerRef.current) {
      clearInterval(paintTimerRef.current);
      paintTimerRef.current = null;
    }
    const v = videoRef.current as any;
    try {
      if (v) {
        if (document.pictureInPictureElement === v) document.exitPictureInPicture();
        else if (v.webkitSetPresentationMode) v.webkitSetPresentationMode("inline");
        (v.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop());
        v.srcObject = null;
      }
    } catch {
      /* ignore */
    }
  }

  /** Paints the countdown onto a canvas that is streamed into a <video> */
  function paint() {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const { remaining: r, pct: p } = frameRef.current;
    const W = c.width;
    const H = c.height;

    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#0b1220");
    g.addColorStop(1, "#131c33");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(232,238,252,.55)";
    ctx.font = "600 22px ui-rounded, system-ui, -apple-system, sans-serif";
    ctx.fillText(r > 0 ? "FOCUS SESSION" : "SESSION COMPLETE", W / 2, 72);

    const tg = ctx.createLinearGradient(W * 0.25, 0, W * 0.75, 0);
    tg.addColorStop(0, "#7cc4ff");
    tg.addColorStop(1, "#b6a2ff");
    ctx.fillStyle = tg;
    ctx.font = "800 132px ui-rounded, system-ui, -apple-system, sans-serif";
    ctx.fillText(r > 0 ? fmt(r) : "0:00", W / 2, H / 2 + 46);

    const bw = W * 0.7;
    const bx = (W - bw) / 2;
    const by = H - 96;
    ctx.fillStyle = "rgba(255,255,255,.12)";
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, 16, 8);
    ctx.fill();
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.roundRect(bx, by, Math.max(16, (bw * p) / 100), 16, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(232,238,252,.5)";
    ctx.font = "500 22px ui-rounded, system-ui, -apple-system, sans-serif";
    ctx.fillText("Let's be in sync · stay focused ✨", W / 2, H - 44);
  }

  /** Video PiP floats above other apps and the home screen on iPadOS / Android */
  function openVideoPip() {
    const c = canvasRef.current;
    const v = videoRef.current as any;
    if (!c || !v) {
      toast.error("Pop-out isn't available on this device");
      return;
    }
    paint();
    if (!v.srcObject) {
      const stream = (c as any).captureStream?.(12);
      if (!stream) {
        toast.error("This browser can't float the timer. Keep the tab open instead.");
        return;
      }
      v.srcObject = stream;
    }
    if (!paintTimerRef.current) paintTimerRef.current = setInterval(paint, 500);
    v.muted = true;
    v.playsInline = true;

    const blocked = () => {
      if (isIosStandalone()) {
        toast.error(
          "iPad home-screen apps block floating windows. Open the site in the Safari browser tab and tap pop-out there.",
        );
      } else {
        toast.error("Your browser blocked the floating timer. Keep this tab open instead.");
      }
    };

    // stay inside the user gesture: don't await play() before requesting PiP
    const request = () => {
      if (v.webkitSetPresentationMode) {
        v.webkitSetPresentationMode("picture-in-picture");
        // Safari fails silently — verify it actually entered PiP
        return new Promise<void>((resolve, reject) =>
          setTimeout(
            () => (v.webkitPresentationMode === "picture-in-picture" ? resolve() : reject(new Error("blocked"))),
            700,
          ),
        );
      }
      if (v.requestPictureInPicture) return v.requestPictureInPicture();
      return Promise.reject(new Error("unsupported"));
    };

    const playPromise = v.play?.();
    if (playPromise?.then) {
      playPromise
        .then(() => request())
        .catch(() => request())
        .catch(blocked);
    } else {
      request().catch(blocked);
    }
  }


  async function openPip() {
    const dpip = (window as any).documentPictureInPicture;
    if (!dpip?.requestWindow) return openVideoPip();
    try {
      const win: Window = await dpip.requestWindow({ width: 320, height: 190 });
    pipRef.current = win;
    const style = win.document.createElement("style");
    style.textContent = `
      *{box-sizing:border-box;margin:0;font-family:ui-rounded,system-ui,-apple-system,"Segoe UI",sans-serif}
      body{height:100%;display:grid;place-items:center;background:#0b1220;color:#e8eefc}
      .wrap{width:100%;padding:20px;text-align:center}
      .label{font-size:11px;letter-spacing:.14em;text-transform:uppercase;opacity:.6}
      .time{font-size:52px;font-weight:800;font-variant-numeric:tabular-nums;margin:6px 0 12px;
        background:linear-gradient(135deg,#7cc4ff,#b6a2ff);-webkit-background-clip:text;background-clip:text;color:transparent}
      .track{height:10px;border-radius:999px;background:rgba(255,255,255,.1);overflow:hidden;
        box-shadow:inset 0 2px 4px rgba(0,0,0,.5)}
      .bar{height:100%;width:0;border-radius:999px;background:linear-gradient(90deg,#7cc4ff,#b6a2ff);transition:width 1s linear}
      .foot{margin-top:12px;font-size:12px;opacity:.65}
    `;
    win.document.head.appendChild(style);
    const wrap = win.document.createElement("div");
    wrap.className = "wrap";
    wrap.innerHTML = `<div class="label" id="lb">Focus session</div>
      <div class="time" id="tm">${fmt(remaining)}</div>
      <div class="track"><div class="bar" id="br" style="width:${pct}%"></div></div>
      <div class="foot">Let's be in sync · stay focused ✨</div>`;
    win.document.body.appendChild(wrap);
    pipNodesRef.current = {
      time: wrap.querySelector("#tm") as HTMLElement,
      bar: wrap.querySelector("#br") as HTMLElement,
      label: wrap.querySelector("#lb") as HTMLElement,
    };
      win.addEventListener("pagehide", () => {
        pipRef.current = null;
        pipNodesRef.current = null;
      });
    } catch {
      openVideoPip();
    }
  }

  const pipSupported = floatSupport !== "unsupported" && floatEnabled !== false;

  // ask once per device, the first time a session runs
  const showAsk =
    !!session && remaining > 0 && !hidden && floatEnabled === null && floatSupport !== "unsupported";




  return (
    <>
      {/* offscreen surface streamed into the floating PiP window */}
      <canvas ref={canvasRef} width={640} height={360} className="pointer-events-none fixed -left-[9999px] top-0 h-px w-px opacity-0" />
      {/* must stay on-screen (Safari refuses PiP for offscreen/hidden video) */}
      <video
        ref={videoRef}
        muted
        playsInline
        autoPlay
        className="pointer-events-none fixed bottom-1 right-1 z-0 h-[2px] w-[2px] opacity-[0.02]"
      />

      <AnimatePresence>
        {showAsk && (
          <motion.div
            key="float-ask"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="clay fixed bottom-40 right-4 z-[85] w-64 p-4 sm:bottom-24"
          >
            <div className="font-display text-sm font-bold">Float the timer?</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Keep your countdown on top while you use other apps. You can change this anytime in Settings.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setFloatEnabled(true);
                  openPip();
                }}
                className="flex-1 rounded-xl bg-gradient-primary px-3 py-2 text-xs font-semibold text-white shadow-clay-sm"
              >
                Allow
              </button>
              <button
                type="button"
                onClick={() => setFloatEnabled(false)}
                className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground"
              >
                Not now
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>


      <AnimatePresence>
        {session && remaining > 0 && !hidden && (
          <motion.div
            key="focus-pill"
            drag
            dragMomentum={false}
            initial={{ opacity: 0, y: 24, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            className="clay fixed bottom-24 right-4 z-[80] flex cursor-grab items-center gap-3 px-4 py-3 active:cursor-grabbing sm:bottom-6"
          >
            <motion.div
              animate={{ scale: [1, 1.12, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-primary text-white shadow-clay-sm"
            >
              <Timer className="h-5 w-5" />
            </motion.div>
            <div className="min-w-[92px]">
              <div className="font-display text-xl font-bold tabular-nums leading-none">
                {fmt(remaining)}
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-primary transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
            {pipSupported && (
              <button
                type="button"
                onClick={openPip}
                title="Keep on top while minimised"
                className="grid h-8 w-8 place-items-center rounded-xl border border-border bg-card text-muted-foreground transition hover:text-foreground"
              >
                <PictureInPicture2 className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setHidden(true)}
              title="Hide"
              className="grid h-8 w-8 place-items-center rounded-xl border border-border bg-card text-muted-foreground transition hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {done && (
          <motion.div
            key="focus-done"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[95] grid place-items-center bg-background/70 p-6 backdrop-blur-sm"
            onClick={() => setDone(false)}
          >
            <motion.div
              initial={{ scale: 0.7, y: 30, rotate: -4 }}
              animate={{ scale: 1, y: 0, rotate: 0 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
              onClick={(e) => e.stopPropagation()}
              className="clay max-w-sm p-8 text-center"
            >
              <motion.div
                animate={{ y: [0, -10, 0], rotate: [-6, 6, -6] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                className="mx-auto grid h-20 w-20 place-items-center rounded-[1.75rem] bg-gradient-primary text-white shadow-glow"
              >
                <PartyPopper className="h-9 w-9" />
              </motion.div>
              <h2 className="mt-5 font-display text-2xl font-bold">Time's up! 🎉</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Focus session finished. Stretch, sip some water, and tick off what you covered.
              </p>
              <div className="mt-4 flex justify-center gap-2" aria-hidden="true">
                {["✨", "💛", "🎯"].map((e, i) => (
                  <motion.span
                    key={e}
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.15 }}
                    className="text-2xl"
                  >
                    {e}
                  </motion.span>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setDone(false)}
                className="mt-6 w-full rounded-xl bg-gradient-primary px-4 py-2.5 text-sm font-semibold text-white shadow-clay-sm transition hover:-translate-y-0.5"
              >
                Nice work
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
