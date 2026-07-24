import { useBadgeCatalog, useUserBadges, tierClass } from "@/lib/badges";
import { formatDistanceToNow, parseISO } from "date-fns";
import { Trophy } from "lucide-react";

export function BadgeShelf({ userIds, title = "Recent achievements" }: { userIds: string[]; title?: string }) {
  const catalog = useBadgeCatalog();
  const badges = useUserBadges(userIds).slice(0, 8);

  return (
    <div className="clay p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="inline-flex items-center gap-2 font-display text-lg font-bold">
          <Trophy className="h-4 w-4 text-amber-500" /> {title}
        </h2>
        <span className="text-xs text-muted-foreground">{Object.keys(catalog).length} to unlock</span>
      </div>
      {badges.length === 0 ? (
        <p className="text-sm text-muted-foreground">Your first achievement is one topic away 🌱</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {badges.map((b) => {
            const meta = catalog[b.badge_key];
            if (!meta) return null;
            return (
              <div
                key={b.id}
                className="clay-pressed group relative flex flex-col items-center gap-1 p-3 text-center transition hover:-translate-y-0.5"
                title={meta.description}
              >
                <div
                  className={`grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br text-2xl shadow-clay-sm ${tierClass(meta.tier)}`}
                >
                  {meta.emoji}
                </div>
                <div className="mt-1 text-[11px] font-bold leading-tight">{meta.title}</div>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
                  {formatDistanceToNow(parseISO(b.unlocked_at), { addSuffix: true })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
