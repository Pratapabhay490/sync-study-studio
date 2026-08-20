import syncMark from "@/assets/sync-mark.png";
import { cn } from "@/lib/utils";

/** Subtle SyncStudy ring mark — used wherever we previously showed AI sparkles. */
export function SyncMark({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <img
      src={syncMark}
      alt=""
      aria-hidden
      style={style}
      className={cn("inline-block h-4 w-4 object-contain opacity-80", className)}
    />
  );
}
