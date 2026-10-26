"use client";

import { useState } from "react";
import type { Count } from "@/lib/dashboard/aggregate";
import { colourFor } from "./colours";

const R = 70;
const STROKE = 26;
const C = 2 * Math.PI * R;

// Part-to-whole for a handful of categories (fold the rest into "Other"
// before passing in). Legend carries every label, count and share.
export function Donut({ data, centreLabel }: { data: Count[]; centreLabel: string }) {
  const [hover, setHover] = useState<string | null>(null);
  const total = data.reduce((s, d) => s + d.count, 0);
  if (!total) return <p className="text-sm text-[color:var(--brand-muted)]">No data.</p>;
  let offset = 0;
  const gap = data.length > 1 ? 2 : 0;
  const active = data.find((d) => d.label === hover);
  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg viewBox="0 0 180 180" className="h-44 w-44 shrink-0" role="img" aria-label={`${centreLabel} by category`}>
        <g transform="rotate(-90 90 90)">
          {data.map((d, i) => {
            const len = (d.count / total) * C;
            const seg = (
              <circle
                key={d.label}
                cx={90}
                cy={90}
                r={R}
                fill="none"
                stroke={colourFor(i, d.label)}
                strokeWidth={hover === d.label ? STROKE + 6 : STROKE}
                strokeDasharray={`${Math.max(0, len - gap)} ${C}`}
                strokeDashoffset={-offset}
                onMouseEnter={() => setHover(d.label)}
                onMouseLeave={() => setHover(null)}
              />
            );
            offset += len;
            return seg;
          })}
        </g>
        <text x={90} y={86} textAnchor="middle" fontSize={22} fontWeight={600} fill="#0e2841">
          {active ? active.count : total}
        </text>
        <text x={90} y={104} textAnchor="middle" fontSize={10} fill="#6b7280">
          {active ? active.label.slice(0, 22) : centreLabel}
        </text>
      </svg>
      <ul className="w-full max-w-xs min-w-[12rem] flex-1 space-y-1 text-xs">
        {data.map((d, i) => (
          <li
            key={d.label}
            className={`flex items-center justify-between gap-3 rounded px-1 ${hover === d.label ? "bg-[color:var(--brand-canvas)]" : ""}`}
            onMouseEnter={() => setHover(d.label)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: colourFor(i, d.label) }} />
              {d.label}
            </span>
            <span className="tabular-nums text-[color:var(--brand-muted)]">
              <strong className="text-[color:var(--brand-ink)]">{d.count}</strong> {Math.round((d.count / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
