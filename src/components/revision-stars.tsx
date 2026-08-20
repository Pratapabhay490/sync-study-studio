import syncLogo from "@/assets/sync-logo.jpeg";
import { cn } from "@/lib/utils";
import { REVISION_TARGET } from "@/lib/data-context";
import { celebrate } from "@/lib/celebrate";

interface Props {
  value: number;
  onChange: (next: number) => void;
  readOnly?: boolean;
  size?: "sm" | "md";
  className?: string;
}

const LABELS = [
  "No revision yet",
  "1st revision done",
  "2nd revision done",
  "3rd revision done",
  "4th revision done",
  "All 5 revisions — exam ready!",
];

export function RevisionStars({ value, onChange, readOnly, size = "md", className }: Props) {
  const filled = Math.max(0, Math.min(REVISION_TARGET, value ?? 0));
  const dim = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const box = size === "sm" ? "h-6 w-6" : "h-7 w-7";

  return (
    <div
      className={cn("flex items-center gap-1", className)}
      role="group"
      aria-label={`Revisions: ${filled} of ${REVISION_TARGET}`}
      title={LABELS[filled]}
    >
      {Array.from({ length: REVISION_TARGET }).map((_, i) => {
        const on = i < filled;
        return (
          <button
            key={i}
            type="button"
            disabled={readOnly}
            aria-label={`Mark ${i + 1} revision${i ? "s" : ""}`}
            onClick={(e) => {
              if (readOnly) return;
              e.stopPropagation();
              // clicking the last filled star un-does it
              const next = filled === i + 1 ? i : i + 1;
              onChange(next);
              if (next === REVISION_TARGET) {
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                celebrate(
                  (r.left + r.width / 2) / window.innerWidth,
                  (r.top + r.height / 2) / window.innerHeight,
                );
              }
            }}
            className={cn(
              "grid shrink-0 place-items-center rounded-xl transition-all",
              box,
              readOnly ? "cursor-default" : "hover:scale-110 active:scale-95",
              on
                ? "star-pop bg-gradient-aurora text-white shadow-clay-sm"
                : "shadow-clay-inset bg-muted text-muted-foreground/50",
            )}
          >
            <img
              src={syncLogo}
              alt=""
              aria-hidden
              className={cn(dim, "rounded-[5px] object-cover transition-all", on ? "opacity-100" : "opacity-40 grayscale")}
            />
          </button>
        );
      })}
    </div>
  );
}
