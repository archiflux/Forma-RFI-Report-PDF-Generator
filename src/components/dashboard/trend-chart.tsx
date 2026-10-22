"use client";

import { useRef, useState } from "react";
import type { MonthPoint } from "@/lib/dashboard/aggregate";
import { ChartTooltip, type TooltipState } from "./chart-tooltip";

const W = 640;
const H = 220;
const PAD = { top: 12, right: 64, bottom: 24, left: 32 };

const SERIES = [
  { key: "created", label: "Created", colour: "var(--series-1)" },
  { key: "closed", label: "Closed", colour: "var(--series-2)" },
] as const;

function monthLabel(m: string): string {
  const [y, mo] = m.split("-");
  return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

// Created vs closed per month: two lines on one axis, crosshair tooltip,
// end-of-line direct labels plus a legend.
export function TrendChart({ data }: { data: MonthPoint[] }) {
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [tip, setTip] = useState<TooltipState | null>(null);
  if (data.length < 2) {
    return <p className="text-sm text-[color:var(--brand-muted)]">Not enough history for a trend yet.</p>;
  }
  const max = Math.max(1, ...data.map((d) => Math.max(d.created, d.closed)));
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (i / (data.length - 1)) * iw;
  const y = (v: number) => PAD.top + ih - (v / max) * ih;
  const ticks = [0, Math.round(max / 2), max];
  const every = Math.ceil(data.length / 8);
  const last = data[data.length - 1] as MonthPoint;
  // End labels: keep at least 12 units apart so they never overprint.
  const yc = y(last.created);
  const yd = y(last.closed);
  const mid = (yc + yd) / 2;
  const gap = Math.abs(yc - yd) < 12 ? 6 : Math.abs(yc - yd) / 2;
  const endY = { created: yc <= yd ? mid - gap : mid + gap, closed: yc <= yd ? mid + gap : mid - gap };

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    const px = ((e.clientX - box.left) / box.width) * W;
    const i = Math.max(0, Math.min(data.length - 1, Math.round(((px - PAD.left) / iw) * (data.length - 1))));
    const d = data[i] as MonthPoint;
    setHover(i);
    setTip({
      x: (x(i) / W) * box.width,
      y: (y(Math.max(d.created, d.closed)) / H) * box.height,
      title: monthLabel(d.month),
      rows: SERIES.map((s) => ({ label: s.label, value: String(d[s.key]), colour: s.colour })),
    });
  }

  return (
    <div className="relative">
      <div className="mb-2 flex gap-3 text-xs text-[color:var(--brand-ink-soft)]">
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded" style={{ background: s.colour }} />
            {s.label}
          </span>
        ))}
      </div>
      <ChartTooltip tip={tip} />
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label="Issues created and closed per month"
        onMouseMove={onMove}
        onMouseLeave={() => {
          setHover(null);
          setTip(null);
        }}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" strokeWidth={1} />
            <text x={PAD.left - 6} y={y(t) + 3} textAnchor="end" fontSize={10} fill="var(--brand-muted)">{t}</text>
          </g>
        ))}
        {data.map((d, i) =>
          i % every === 0 ? (
            <text key={d.month} x={x(i)} y={H - 6} textAnchor="middle" fontSize={10} fill="var(--brand-muted)">
              {monthLabel(d.month)}
            </text>
          ) : null,
        )}
        {hover !== null ? (
          <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + ih} stroke="var(--brand-muted)" strokeDasharray="3 3" />
        ) : null}
        {SERIES.map((s) => (
          <g key={s.key}>
            <polyline
              fill="none"
              stroke={s.colour}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              points={data.map((d, i) => `${x(i)},${y(d[s.key])}`).join(" ")}
            />
            {hover !== null ? (
              <circle cx={x(hover)} cy={y((data[hover] as MonthPoint)[s.key])} r={4} fill={s.colour} stroke="white" strokeWidth={2} />
            ) : null}
            <text
              x={x(data.length - 1) + 6}
              y={endY[s.key] + 3}
              fontSize={10}
              fill="var(--brand-ink-soft)"
            >
              {s.label} {last[s.key]}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
