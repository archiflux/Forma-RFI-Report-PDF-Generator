"use client";

import type { Count } from "@/lib/dashboard/aggregate";

// Single-series horizontal bars. Values sit in a text column so the bar
// carries magnitude and the number carries the exact count.
export function BarList({
  data,
  onSelect,
  selected = [],
}: {
  data: Count[];
  onSelect?: (label: string) => void;
  selected?: string[];
}) {
  const max = Math.max(1, ...data.map((d) => d.count));
  if (!data.length) return <p className="text-sm text-[color:var(--brand-muted)]">No issues.</p>;
  return (
    <ul className="space-y-1.5">
      {data.map((d) => {
        const active = selected.includes(d.label);
        const clickable = onSelect && d.label !== "Other";
        return (
          <li key={d.label}>
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onSelect(d.label)}
              title={`${d.label}: ${d.count}`}
              className="group grid w-full grid-cols-[minmax(0,10rem)_1fr_3rem] items-center gap-2 rounded-md px-1 py-0.5 text-left text-xs hover:bg-[color:var(--brand-canvas)] disabled:cursor-default"
            >
              <span className={`truncate ${active ? "font-semibold text-[color:var(--brand-primary)]" : "text-[color:var(--brand-ink-soft)]"}`}>
                {d.label}
              </span>
              <span className="h-3">
                <span
                  className="block h-3 rounded-r-[4px] transition-opacity group-hover:opacity-80"
                  style={{
                    width: `${Math.max(1, (d.count / max) * 100)}%`,
                    background: "var(--series-1)",
                    opacity: selected.length && !active ? 0.35 : 1,
                  }}
                />
              </span>
              <span className="text-right font-semibold tabular-nums">{d.count}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
