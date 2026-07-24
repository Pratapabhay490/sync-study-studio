export function StreakFlame({ days, label = "together streak" }: { days: number; label?: string }) {
  const emoji = days >= 30 ? "🌟" : days >= 14 ? "🔥🔥🔥" : days >= 7 ? "🔥🔥" : "🔥";
  const glow =
    days >= 14 ? "shadow-[0_0_24px_rgba(251,146,60,0.6)]" : days >= 7 ? "shadow-[0_0_16px_rgba(251,146,60,0.4)]" : "";
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-orange-500/15 to-rose-500/15 px-3 py-1 text-xs font-bold text-orange-500 ${glow}`}
    >
      <span className={days >= 3 ? "animate-pulse" : ""}>{emoji}</span>
      <span className="tabular-nums">{days}d {label}</span>
    </div>
  );
}
