"use client";

import { useState } from "react";
import {
  BUCKET_LABEL,
  STATUS_BUCKETS,
  type ProjectStatusRow,
  type StatusBucket,
} from "@/lib/dashboard/aggregate";
import { ChartTooltip, type TooltipState } from "./chart-tooltip";

export const BUCKET_COLOUR: Record<StatusBucket, string> = {
  open: "var(--series-1)",
  inProgress: "var(--series-2)",
  completed: "var(--series-3)",
  closed: "var(--series-4)",
};

export function StatusLegend() {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-[color:var(--brand-ink-soft)]">
      {STATUS_BUCKETS.map((b) => (
        <span key={b} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: BUCKET_COLOUR[b] }} />
          {BUCKET_LABEL[b]}
        </span>
      ))}
    </div>
  );
}

// Stacked status bar per project, with the counts repeated as columns so
// the low-contrast segments never carry the value alone.
export function ProjectStatus({ rows }: { rows: ProjectStatusRow[] }) {
  const [tip, setTip] = useState<TooltipState | null>(null);
  const max = Math.max(1, ...rows.map((r) => r.total));
  return (
    <div className="relative overflow-x-auto" onMouseLeave={() => setTip(null)}>
      <ChartTooltip tip={tip} />
      <table className="w-full min-w-[640px] text-xs">
        <thead className="text-left text-[color:var(--brand-muted)]">
          <tr>
            <th className="py-1 pr-2 font-medium">Project</th>
            <th className="w-[40%] py-1 pr-2 font-medium">Status</th>
            {STATUS_BUCKETS.map((b) => (
              <th key={b} className="py-1 pr-2 text-right font-medium">{BUCKET_LABEL[b]}</th>
            ))}
            <th className="py-1 pr-2 text-right font-medium">Overdue</th>
            <th className="py-1 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.projectId} className="border-t border-[color:var(--brand-border)]">
              <td className="max-w-[14rem] truncate py-1.5 pr-2 font-medium" title={r.projectName}>{r.projectName}</td>
              <td className="py-1.5 pr-2">
                <div className="flex h-3 gap-[2px]" style={{ width: `${(r.total / max) * 100}%` }}>
                  {STATUS_BUCKETS.filter((b) => r.counts[b] > 0).map((b, idx, arr) => (
                    <span
                      key={b}
                      className={idx === arr.length - 1 ? "rounded-r-[4px]" : ""}
                      style={{ flexGrow: r.counts[b], background: BUCKET_COLOUR[b] }}
                      onMouseMove={(e) => {
                        const box = e.currentTarget.closest(".relative")?.getBoundingClientRect();
                        if (!box) return;
                        setTip({
                          x: e.clientX - box.left,
                          y: e.clientY - box.top,
                          title: r.projectName,
                          rows: [{ label: BUCKET_LABEL[b], value: String(r.counts[b]), colour: BUCKET_COLOUR[b] }],
                        });
                      }}
                    />
                  ))}
                </div>
              </td>
              {STATUS_BUCKETS.map((b) => (
                <td key={b} className="py-1.5 pr-2 text-right tabular-nums">{r.counts[b]}</td>
              ))}
              <td className={`py-1.5 pr-2 text-right tabular-nums ${r.overdue ? "font-semibold text-[color:var(--status-critical)]" : ""}`}>
                {r.overdue}
              </td>
              <td className="py-1.5 text-right font-semibold tabular-nums">{r.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
