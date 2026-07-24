import { motion } from "framer-motion";

/**
 * Living tree that grows with combined weekly XP. Purely presentational.
 */
export function StudyTree({ xp, together = 0 }: { xp: number; together?: number }) {
  const stage = xp >= 2000 ? 5 : xp >= 1000 ? 4 : xp >= 500 ? 3 : xp >= 200 ? 2 : xp >= 50 ? 1 : 0;
  const stageName = ["Seed", "Sprout", "Sapling", "Young Tree", "Flowering", "Fruiting"][stage];
  const trunkH = 20 + stage * 22;
  const canopyR = 12 + stage * 14;
  const fruits = stage >= 4 ? 5 : stage >= 3 ? 3 : 0;
  const flowers = stage >= 3 ? 4 : 0;

  return (
    <div className="clay flex flex-col items-center p-6">
      <div className="mb-3 w-full text-center">
        <h2 className="font-display text-lg font-bold">Your study tree</h2>
        <p className="text-xs text-muted-foreground">Grows with every topic, quiz, and session you two finish together.</p>
      </div>
      <div className="relative h-56 w-56">
        <svg viewBox="0 0 200 200" className="h-full w-full">
          {/* soil */}
          <ellipse cx="100" cy="180" rx="70" ry="10" fill="url(#soil)" />
          <defs>
            <radialGradient id="soil">
              <stop offset="0%" stopColor="#a16207" />
              <stop offset="100%" stopColor="#78350f" />
            </radialGradient>
            <linearGradient id="trunk" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#92400e" />
              <stop offset="100%" stopColor="#57200a" />
            </linearGradient>
            <radialGradient id="leaf">
              <stop offset="0%" stopColor="#86efac" />
              <stop offset="100%" stopColor="#15803d" />
            </radialGradient>
          </defs>
          {/* trunk */}
          <motion.rect
            initial={{ height: 0 }}
            animate={{ height: trunkH }}
            transition={{ duration: 1, ease: "easeOut" }}
            x={94}
            y={180 - trunkH}
            width={12}
            rx={4}
            fill="url(#trunk)"
          />
          {/* canopy */}
          {stage >= 1 && (
            <motion.circle
              initial={{ r: 0 }}
              animate={{ r: canopyR }}
              transition={{ duration: 1.1, ease: "easeOut" }}
              cx={100}
              cy={180 - trunkH - canopyR / 2}
              fill="url(#leaf)"
            />
          )}
          {stage >= 2 && (
            <motion.circle
              initial={{ r: 0 }}
              animate={{ r: canopyR - 4 }}
              transition={{ duration: 1.1, delay: 0.1 }}
              cx={100 - canopyR / 2}
              cy={180 - trunkH - canopyR / 3}
              fill="url(#leaf)"
            />
          )}
          {stage >= 2 && (
            <motion.circle
              initial={{ r: 0 }}
              animate={{ r: canopyR - 4 }}
              transition={{ duration: 1.1, delay: 0.15 }}
              cx={100 + canopyR / 2}
              cy={180 - trunkH - canopyR / 3}
              fill="url(#leaf)"
            />
          )}
          {/* flowers */}
          {Array.from({ length: flowers }).map((_, i) => (
            <motion.circle
              key={"f" + i}
              initial={{ r: 0 }}
              animate={{ r: 3 }}
              transition={{ delay: 0.8 + i * 0.1 }}
              cx={100 + Math.cos(i * 1.4) * canopyR * 0.7}
              cy={180 - trunkH - canopyR / 2 + Math.sin(i * 1.4) * canopyR * 0.5}
              fill="#fbcfe8"
            />
          ))}
          {/* fruits */}
          {Array.from({ length: fruits }).map((_, i) => (
            <motion.circle
              key={"fr" + i}
              initial={{ r: 0 }}
              animate={{ r: 4 }}
              transition={{ delay: 1 + i * 0.12, type: "spring" }}
              cx={100 + Math.cos(i * 2) * canopyR * 0.6}
              cy={180 - trunkH - canopyR / 2 + Math.sin(i * 2) * canopyR * 0.4}
              fill="#ef4444"
            />
          ))}
          {stage === 0 && (
            <motion.circle
              initial={{ r: 0 }}
              animate={{ r: 6 }}
              cx={100}
              cy={172}
              fill="#84cc16"
            />
          )}
        </svg>
      </div>
      <div className="mt-3 flex items-center gap-3 text-center">
        <div>
          <div className="font-display text-lg font-bold text-gradient">{stageName}</div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Stage {stage + 1} of 6</div>
        </div>
        {together > 0 && (
          <div className="border-l border-border pl-3">
            <div className="font-display text-lg font-bold">{together}d</div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Together</div>
          </div>
        )}
      </div>
    </div>
  );
}
