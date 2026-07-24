import { motion } from "framer-motion";
import { useMemo, useState } from "react";

/** A tiny evolving pet that grows with combined consistency. */
export function PartnerMascot({ sharedStreak, combinedXp }: { sharedStreak: number; combinedXp: number }) {
  const [open, setOpen] = useState(false);

  const stage = useMemo(() => {
    const score = sharedStreak * 3 + Math.floor(combinedXp / 200);
    if (score >= 30) return { emoji: "🦄", name: "Mythic", tint: "from-fuchsia-400 to-amber-300" };
    if (score >= 18) return { emoji: "🐉", name: "Dragon", tint: "from-emerald-400 to-cyan-400" };
    if (score >= 10) return { emoji: "🦊", name: "Fox", tint: "from-orange-400 to-rose-400" };
    if (score >= 4) return { emoji: "🐣", name: "Chick", tint: "from-amber-300 to-yellow-200" };
    return { emoji: "🥚", name: "Egg", tint: "from-slate-300 to-slate-100" };
  }, [sharedStreak, combinedXp]);

  return (
    <div className="pointer-events-none fixed bottom-24 right-4 z-[70] md:bottom-6">
      <motion.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className={`pointer-events-auto grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br ${stage.tint} text-3xl shadow-clay`}
        aria-label={`Partner pet: ${stage.name}`}
      >
        {stage.emoji}
      </motion.button>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="pointer-events-auto clay absolute bottom-16 right-0 w-56 p-3 text-xs"
        >
          <div className="font-bold">Meet your {stage.name}</div>
          <div className="mt-1 text-muted-foreground">
            Grows with your shared streak & XP. Keep showing up together to evolve 🌱
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
            <span>🔥 {sharedStreak}d together</span>
            <span>✨ {combinedXp} XP</span>
          </div>
        </motion.div>
      )}
    </div>
  );
}
