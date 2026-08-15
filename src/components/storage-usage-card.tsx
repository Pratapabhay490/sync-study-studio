import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, HardDrive, AlertTriangle } from "lucide-react";

type TableRow = { table: string; bytes: number; rows: number };
type Report = {
  total_bytes: number;
  limit_bytes: number;
  percent_used: number;
  tables: TableRow[];
  generated_at: string;
};

function fmt(bytes: number) {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

export function StorageUsageCard() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("db_usage_report" as never);
    if (!error && data) setReport(data as unknown as Report);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const pct = report ? Math.min(100, report.percent_used) : 0;
  const warn = pct >= 75;
  const critical = pct >= 90;

  return (
    <div className="clay rounded-3xl border-0 p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="shadow-clay-sm flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-primary">
            <HardDrive className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold">Storage usage</h3>
            <p className="text-xs text-muted-foreground">Database space used by the app</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => void load()} aria-label="Refresh usage">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>

      {!report && loading && <div className="text-sm text-muted-foreground">Checking…</div>}

      {report && (
        <>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="font-display text-2xl font-bold">{fmt(report.total_bytes)}</span>
            <span className="text-xs text-muted-foreground">of {fmt(report.limit_bytes)} · {pct}%</span>
          </div>
          <div className="shadow-clay-inset h-3 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                critical ? "bg-destructive" : warn ? "bg-amber-500" : "bg-gradient-primary"
              }`}
              style={{ width: `${Math.max(2, pct)}%` }}
            />
          </div>

          {warn && (
            <div className="mt-3 flex items-start gap-2 rounded-2xl bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {critical
                  ? "Storage is nearly full — upgrade the database or trim old data soon."
                  : "Storage is filling up. Keep an eye on it before adding many more users."}
              </span>
            </div>
          )}

          <div className="mt-4 space-y-1.5">
            {report.tables.slice(0, 5).map((t) => (
              <div key={t.table} className="flex items-center justify-between text-xs">
                <span className="truncate text-muted-foreground">{t.table}</span>
                <span className="font-medium">{fmt(t.bytes)}</span>
              </div>
            ))}
          </div>

          <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
            Auto-cleanup runs nightly: delivered notifications older than 30 days, pokes and reactions older than 90 days,
            and focus sessions older than 180 days. Quiz history, analytics, XP, badges and revisions are never deleted.
          </p>
        </>
      )}
    </div>
  );
}
