"use client";

import { useState } from "react";
import { useWidth } from "./use-width";
import type { Count } from "@/lib/dashboard/aggregate";
import { squarify } from "@/lib/charts/treemap";
import { HEAT_RAMP } from "@/lib/dashboard/globe";
import { ChartTooltip, type TooltipState } from "@/components/dashboard/chart-tooltip";

const H = 280;

// Tiles sized by count and shaded by rank (largest darkest, one hue), so
// the order reads at a glance; every tile is labelled when it fits. Drawn
// at the container's pixel width so text stays a normal size.
export function Treemap({ data, onSelect, selected = [] }: { data: Count[]; onSelect?: (label: string) => void; selected?: string[] }) {
  const [tip, setTip] = useState<TooltipState | null>(null);
  const [box, W] = useWidth<HTMLDivElement>();
  const rects = squarify(data, (d) => d.count, W, H);
  const ranked = [...data].sort((a, b) => b.count - a.count).map((d) => d.label);
  const total = data.reduce((s, d) => s + d.count, 0);
  if (!data.some((d) => d.count > 0)) return <p className="text-sm text-[color:var(--brand-muted)]">No data.</p>;
  return (
    <div ref={box} className="relative" style={{ height: H }} onMouseLeave={() => setTip(null)}>
      <ChartTooltip tip={tip} />
      <svg width={W} height={H} className="block" role="img" aria-label="Treemap">
        {rects.map(({ item, x, y, w, h }) => {
          const rank = ranked.indexOf(item.label);
          const step = item.label === "Other" ? 0 : Math.max(0, HEAT_RAMP.length - 1 - Math.floor((rank / Math.max(1, ranked.length)) * HEAT_RAMP.length));
          const fill = HEAT_RAMP[step] as string;
          const dark = step >= 2;
          const dim = selected.length > 0 && !selected.includes(item.label);
          const clickable = onSelect && item.label !== "Other";
          return (
            <g
              key={item.label}
              opacity={dim ? 0.35 : 1}
              className={clickable ? "cursor-pointer" : undefined}
              onClick={() => clickable && onSelect(item.label)}
              onMouseMove={(e) => {
                const box = (e.currentTarget.closest(".relative") as HTMLElement | null)?.getBoundingClientRect();
                if (!box) return;
                setTip({
                  x: e.clientX - box.left,
                  y: e.clientY - box.top,
                  title: item.label,
                  rows: [
                    { label: "Count", value: String(item.count) },
                    { label: "Share", value: `${Math.round((item.count / total) * 100)}%` },
                  ],
                });
              }}
            >
              <rect x={x + 1} y={y + 1} width={Math.max(0, w - 2)} height={Math.max(0, h - 2)} rx={4} fill={fill} />
              {w > 54 && h > 34 ? (
                <>
                  <text x={x + 10} y={y + 20} fontSize={12} fontWeight={600} fill={dark ? "#ffffff" : "#0e2841"}>
                    {item.label.length > w / 7.5 ? `${item.label.slice(0, Math.max(3, Math.floor(w / 7.5) - 1))}…` : item.label}
                  </text>
                  <text x={x + 10} y={y + 37} fontSize={12} fill={dark ? "#ffffff" : "#2a2f36"} opacity={0.9}>
                    {item.count} ({Math.round((item.count / total) * 100)}%)
                  </text>
                </>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
