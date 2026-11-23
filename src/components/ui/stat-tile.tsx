"use client";

import { useEffect, useRef, useState } from "react";

// Holdpoint stat tile: white, a 4px top edge coloured by meaning, an
// uppercase label and a big Chakra Petch number. Teal for actionable,
// citron for needs attention, green for done, slate for context.
export type StatTone = "teal" | "citron" | "done" | "slate";
const TONE: Record<StatTone, { edge: string; ink: string }> = {
  teal: { edge: "var(--bp-teal)", ink: "var(--bp-teal)" },
  citron: { edge: "var(--bp-citron)", ink: "var(--bp-citron-ink)" },
  done: { edge: "var(--done-bar)", ink: "var(--done)" },
  slate: { edge: "#7c8a90", ink: "var(--slate-600)" },
};

// Counts a whole number up from its previous value (0 on first show).
export function useCountUp(target: number, ms = 700): number {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (!Number.isFinite(target)) return;
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const e = 1 - Math.pow(1 - t, 3);
      const v = Math.round(a + (target - a) * e);
      setShown(v);
      if (t < 1) raf = requestAnimationFrame(step);
      else from.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      from.current = target;
    };
  }, [target, ms]);
  return shown;
}

function Value({ value }: { value: string | number }) {
  // Whole numbers ("1,204" or 1204) count up; anything else shows as is.
  const n = typeof value === "number" ? value : /^\d[\d,]*$/.test(value) ? Number(value.replace(/,/g, "")) : NaN;
  const counted = useCountUp(Number.isFinite(n) ? n : 0);
  return <>{Number.isFinite(n) ? counted.toLocaleString("en-GB") : value}</>;
}

export function StatTile({
  label,
  value,
  hint,
  alert,
  tone,
  index = 0,
}: {
  label: string;
  value: string | number;
  hint?: string;
  // Shorthand for tone "citron" (needs attention).
  alert?: boolean;
  tone?: StatTone;
  index?: number;
}) {
  const t = TONE[tone ?? (alert ? "citron" : "teal")];
  return (
    <div className="sb-enter relative bg-white px-4 py-3 shadow-hp-sm" style={{ borderTop: `4px solid ${t.edge}`, ["--sb-i" as string]: index }}>
      <p className="bp-label">{label}</p>
      <p className="mt-1 font-display text-[30px] font-semibold leading-9 tabular-nums" style={{ color: t.ink }}>
        <Value value={value} />
      </p>
      {hint ? <p className="mt-0.5 text-xs text-[color:var(--slate-600)]">{hint}</p> : null}
    </div>
  );
}
