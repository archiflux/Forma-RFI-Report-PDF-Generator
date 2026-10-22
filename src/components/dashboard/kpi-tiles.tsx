import type { Kpis } from "@/lib/dashboard/aggregate";

function Tile({ label, value, hint, alert }: { label: string; value: string; hint?: string; alert?: boolean }) {
  return (
    <div className="rounded-xl border border-[color:var(--brand-border)] bg-white p-4 shadow-card">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-muted)]">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold tabular-nums ${alert ? "text-[color:var(--status-critical)]" : "text-[color:var(--brand-primary)]"}`}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-[color:var(--brand-muted)]">{hint}</p> : null}
    </div>
  );
}

function pct(n: number, d: number): string {
  return d ? `${Math.round((n / d) * 100)}% of total` : "";
}

export function KpiTiles({ k }: { k: Kpis }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Tile label="Issues" value={String(k.total)} />
      <Tile label="Outstanding" value={String(k.outstanding)} hint={pct(k.outstanding, k.total)} />
      <Tile label="Overdue" value={String(k.overdue)} hint={k.overdue ? "Outstanding past due date" : "None past due"} alert={k.overdue > 0} />
      <Tile label="Completed or closed" value={String(k.closed)} hint={pct(k.closed, k.total)} />
      <Tile label="Avg days to close" value={k.avgDaysToClose === null ? "-" : k.avgDaysToClose.toFixed(1)} />
      <Tile label="Pinned to model" value={String(k.withViewpoint)} hint={pct(k.withViewpoint, k.total)} />
    </div>
  );
}
