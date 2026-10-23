"use client";

import { useRef, useState } from "react";
import { ChartTooltip, type TooltipState } from "./chart-tooltip";

const W = 640;
const H = 220;
const PAD = { top: 12, right: 64, bottom: 24, left: 32 };

export interface TrendSeries {
  key: string;
  label: string;
  colour: string;
}

type Row = { month: string };

const ISSUE_SERIES: TrendSeries[] = [
  { key: "created", label: "Created", colour: "var(--series-1)" },
  { key: "closed", label: "Closed", colour: "var(--series-2)" },
];

function monthLabel(m: string): string {
  const [y, mo] = m.split("-");
  return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

// Monthly lines on one axis (one or two series), crosshair tooltip,
// end-of-line direct labels, and a legend when there are two series.
export function TrendChart({
  data,
  series = ISSUE_SERIES,
  ariaLabel = "Issues created and closed per month",
}: {
  data: Row[];
  series?: TrendSeries[];
  ariaLabel?: string;
}) {
  const SERIES = series;
  const v = (d: Row, k: string) => Number((d as unknown as Record<string, unknown>)[k] ?? 0);
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [tip, setTip] = useState<TooltipState | null>(null);
  if (data.length < 2) {
    return <p className="text-sm text-[color:var(--brand-muted)]">Not enough history for a trend yet.</p>;
  }
  const peak = (d: Row) => Math.max(...SERIES.map((s) => v(d, s.key)));
  const max = Math.max(1, ...data.map(peak));
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (i / (data.length - 1)) * iw;
  const y = (v: number) => PAD.top + ih - (v / max) * ih;
  const ticks = [0, Math.round(max / 2), max];
  const every = Math.ceil(data.length / 8);
  const last = data[data.length - 1] as Row;
  // End labels: with two series keep them at least 12 units apart so they
  // never overprint.
  const endY: Record<string, number> = {};
  const [a, b] = SERIES;
  if (a && b) {
    const ya = y(v(last, a.key));
    const yb = y(v(last, b.key));
    const mid = (ya + yb) / 2;
    const gap = Math.abs(ya - yb) < 12 ? 6 : Math.abs(ya - yb) / 2;
    endY[a.key] = ya <= yb ? mid - gap : mid + gap;
    endY[b.key] = ya <= yb ? mid + gap : mid - gap;
  } else if (a) {
    endY[a.key] = y(v(last, a.key));
  }

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    const px = ((e.clientX - box.left) / box.width) * W;
    const i = Math.max(0, Math.min(data.length - 1, Math.round(((px - PAD.left) / iw) * (data.length - 1))));
    const d = data[i] as Row;
    setHover(i);
    setTip({
      x: (x(i) / W) * box.width,
      y: (y(peak(d)) / H) * box.height,
      title: monthLabel(d.month),
      rows: SERIES.map((s) => ({ label: s.label, value: String(v(d, s.key)), colour: s.colour })),
    });
  }

  return (
    <div className="relative">
      {SERIES.length > 1 ? (
        <div className="mb-2 flex gap-3 text-xs text-[color:var(--brand-ink-soft)]">
          {SERIES.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded" style={{ background: s.colour }} />
              {s.label}
            </span>
          ))}
        </div>
      ) : null}
      <ChartTooltip tip={tip} />
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={ariaLabel}
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
              points={data.map((d, i) => `${x(i)},${y(v(d, s.key))}`).join(" ")}
            />
            {hover !== null ? (
              <circle cx={x(hover)} cy={y(v(data[hover] as Row, s.key))} r={4} fill={s.colour} stroke="white" strokeWidth={2} />
            ) : null}
            <text
              x={x(data.length - 1) + 6}
              y={(endY[s.key] ?? 0) + 3}
              fontSize={10}
              fill="var(--brand-ink-soft)"
            >
              {s.label} {v(last, s.key)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
