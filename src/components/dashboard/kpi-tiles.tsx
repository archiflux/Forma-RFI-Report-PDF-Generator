import { StatTile as Tile } from "@/components/ui/stat-tile";
import type { Kpis } from "@/lib/dashboard/aggregate";

function pct(n: number, d: number): string {
  return d ? `${Math.round((n / d) * 100)}% of total` : "";
}

export function KpiTiles({ k }: { k: Kpis }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Tile index={0} tone="teal" label="Issues" value={String(k.total)} />
      <Tile index={1} tone="teal" label="Outstanding" value={String(k.outstanding)} hint={pct(k.outstanding, k.total)} />
      <Tile index={2} label="Overdue" value={String(k.overdue)} hint={k.overdue ? "Outstanding past due date" : "None past due"} tone={k.overdue > 0 ? "citron" : "slate"} />
      <Tile index={3} tone="done" label="Completed or closed" value={String(k.closed)} hint={pct(k.closed, k.total)} />
      <Tile index={4} tone="slate" label="Avg days to close" value={k.avgDaysToClose === null ? "-" : k.avgDaysToClose.toFixed(1)} />
      <Tile index={5} tone="slate" label="Pinned to model" value={String(k.withViewpoint)} hint={pct(k.withViewpoint, k.total)} />
    </div>
  );
}
