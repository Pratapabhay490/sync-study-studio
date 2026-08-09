/** Short, friendly three-note chime played when a focus session ends. */
export function playChime() {
  try {
    const Ctx =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const resume = ctx.resume?.();
    const start = () => {
      const now = ctx.currentTime;
      [
        { f: 659.25, t: 0 },
        { f: 783.99, t: 0.16 },
        { f: 1046.5, t: 0.32 },
      ].forEach(({ f, t }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = f;
        gain.gain.setValueAtTime(0.0001, now + t);
        gain.gain.exponentialRampToValueAtTime(0.25, now + t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.55);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + t);
        osc.stop(now + t + 0.6);
      });
      setTimeout(() => ctx.close?.(), 1500);
    };
    if (resume?.then) resume.then(start).catch(start);
    else start();
  } catch {
    /* ignore */
  }
}

/** Keeps an AudioContext warm so the end-chime can play after a long session. */
export function primeAudio() {
  try {
    const Ctx =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.02);
    setTimeout(() => ctx.close?.(), 300);
  } catch {
    /* ignore */
  }
}
