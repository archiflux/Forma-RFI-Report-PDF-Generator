import { StatTile as Tile } from "@/components/ui/stat-tile";
import type { Kpis } from "@/lib/dashboard/aggregate";

function pct(n: number, d: number): string {
  return d ? `${Math.round((n / d) * 100)}% of total` : "";
}

export function KpiTiles({ k }: { k: Kpis }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Tile index={0} label="Issues" value={String(k.total)} />
      <Tile index={1} label="Outstanding" value={String(k.outstanding)} hint={pct(k.outstanding, k.total)} />
      <Tile index={2} label="Overdue" value={String(k.overdue)} hint={k.overdue ? "Outstanding past due date" : "None past due"} alert={k.overdue > 0} />
      <Tile index={3} label="Completed or closed" value={String(k.closed)} hint={pct(k.closed, k.total)} />
      <Tile index={4} label="Avg days to close" value={k.avgDaysToClose === null ? "-" : k.avgDaysToClose.toFixed(1)} />
      <Tile index={5} label="Pinned to model" value={String(k.withViewpoint)} hint={pct(k.withViewpoint, k.total)} />
    </div>
  );
}
