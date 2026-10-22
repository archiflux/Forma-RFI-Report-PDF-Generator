"use client";

export interface TooltipState {
  x: number;
  y: number;
  title: string;
  rows: Array<{ label: string; value: string; colour?: string }>;
}

// Positioned relative to the nearest `relative` ancestor.
export function ChartTooltip({ tip }: { tip: TooltipState | null }) {
  if (!tip) return null;
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-10 min-w-36 -translate-x-1/2 -translate-y-full rounded-lg border border-[color:var(--brand-border)] bg-white px-3 py-2 text-xs shadow-card"
      style={{ left: tip.x, top: tip.y - 8 }}
    >
      <p className="font-semibold text-[color:var(--brand-primary)]">{tip.title}</p>
      {tip.rows.map((r) => (
        <p key={r.label} className="mt-1 flex items-center justify-between gap-3 text-[color:var(--brand-ink-soft)]">
          <span className="flex items-center gap-1.5">
            {r.colour ? <span className="h-2 w-2 rounded-sm" style={{ background: r.colour }} /> : null}
            {r.label}
          </span>
          <span className="font-semibold tabular-nums text-[color:var(--brand-ink)]">{r.value}</span>
        </p>
      ))}
    </div>
  );
}
