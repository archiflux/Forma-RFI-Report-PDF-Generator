"use client";

import { useRef, useState } from "react";
import { ChartTooltip, type TooltipState } from "@/components/dashboard/chart-tooltip";
import { colourFor } from "./colours";

const W = 640;
const H = 230;
const PAD = { top: 12, right: 26, bottom: 24, left: 34 };

function monthLabel(m: string): string {
  const [y, mo] = m.split("-");
  return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

// Monthly totals stacked by category, with a crosshair tooltip listing
// every category for the hovered month. `colours` overrides the default
// categorical order (e.g. fixed status colours).
export function StackedArea({
  rows,
  categories,
  colours,
}: {
  rows: Array<{ month: string } & Record<string, number>>;
  categories: string[];
  colours?: Record<string, string>;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [tip, setTip] = useState<TooltipState | null>(null);
  if (rows.length < 2) return <p className="text-sm text-[color:var(--brand-muted)]">Not enough history yet.</p>;
  const colour = (c: string, i: number) => colours?.[c] ?? colourFor(i, c);
  const totals = rows.map((r) => categories.reduce((s, c) => s + (r[c] ?? 0), 0));
  const max = Math.max(1, ...totals);
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (i / (rows.length - 1)) * iw;
  const y = (v: number) => PAD.top + ih - (v / max) * ih;
  // Cumulative baselines per category, bottom to top.
  const stacks = categories.map((_, ci) => rows.map((r) => categories.slice(0, ci + 1).reduce((s, c) => s + (r[c] ?? 0), 0)));
  const every = Math.ceil(rows.length / 8);

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    const px = ((e.clientX - box.left) / box.width) * W;
    const i = Math.max(0, Math.min(rows.length - 1, Math.round(((px - PAD.left) / iw) * (rows.length - 1))));
    const r = rows[i] as { month: string } & Record<string, number>;
    setHover(i);
    setTip({
      x: (x(i) / W) * box.width,
      y: (y(totals[i] ?? 0) / H) * box.height,
      title: `${monthLabel(r.month)}: ${totals[i]}`,
      rows: [...categories].reverse().map((c) => ({ label: c, value: String(r[c] ?? 0), colour: colour(c, categories.indexOf(c)) })),
    });
  }

  return (
    <div className="relative">
      <div className="mb-2 flex flex-wrap gap-3 text-xs text-[color:var(--brand-ink-soft)]">
        {categories.map((c, i) => (
          <span key={c} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: colour(c, i) }} />
            {c}
          </span>
        ))}
      </div>
      <ChartTooltip tip={tip} />
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label="Monthly totals by category"
        onMouseMove={onMove}
        onMouseLeave={() => {
          setHover(null);
          setTip(null);
        }}
      >
        {[0, Math.round(max / 2), max].filter((v, i, a) => a.indexOf(v) === i).map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" />
            <text x={PAD.left - 6} y={y(t) + 3} textAnchor="end" fontSize={10} fill="var(--brand-muted)">{t}</text>
          </g>
        ))}
        {rows.map((r, i) =>
          i % every === 0 ? (
            <text key={r.month} x={x(i)} y={H - 6} textAnchor="middle" fontSize={10} fill="var(--brand-muted)">{monthLabel(r.month)}</text>
          ) : null,
        )}
        {[...categories.keys()].reverse().map((ci) => {
          const top = stacks[ci] as number[];
          const bottom = ci === 0 ? rows.map(() => 0) : (stacks[ci - 1] as number[]);
          const d =
            top.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ") +
            " " +
            bottom
              .map((v, i) => [x(i), y(v)] as const)
              .reverse()
              .map(([px, py]) => `L${px},${py}`)
              .join(" ") +
            " Z";
          return <path key={categories[ci]} d={d} fill={colour(categories[ci] as string, ci)} fillOpacity={0.85} stroke="#ffffff" strokeWidth={1.5} />;
        })}
        {hover !== null ? <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + ih} stroke="#0e2841" strokeDasharray="3 3" /> : null}
      </svg>
    </div>
  );
}
