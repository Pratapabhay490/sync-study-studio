import { motion } from "framer-motion";
import { levelProgress, levelTitle, useCountUp } from "@/lib/xp";
import { Sparkles } from "lucide-react";

export function XpBar({
  xp,
  compact = false,
  label,
}: {
  xp: number;
  compact?: boolean;
  label?: string;
}) {
  const { level, into, span, pct } = levelProgress(xp);
  const shown = useCountUp(xp);
  return (
    <div className={compact ? "flex items-center gap-3" : "flex flex-col gap-2"}>
      <div className="flex items-center gap-2">
        <div className="grid h-7 min-w-7 place-items-center rounded-full bg-gradient-primary px-2 text-[11px] font-bold text-white shadow-clay-sm">
          Lv {level}
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-xs font-semibold">{label ?? levelTitle(level)}</span>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {shown} XP · {into}/{span} to Lv {level + 1}
          </span>
        </div>
      </div>
      <div className={`h-2 overflow-hidden rounded-full bg-muted ${compact ? "w-32" : "w-full"}`}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="h-full bg-gradient-primary"
        />
      </div>
      {!compact && (
        <div className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
          <Sparkles className="h-3 w-3" /> Every topic, quiz & session adds XP
        </div>
      )}
    </div>
  );
}
