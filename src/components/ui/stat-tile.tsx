"use client";

import { useEffect, useRef, useState } from "react";

// Colour stripe per tile, cycling through the brand's teal, navy and
// yellow; alerts are red.
const TONES = ["#006881", "#0e2841", "#d1c800", "#0a8aa6", "#143644", "#b5ad00"];

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

export function StatTile({ label, value, hint, alert, index = 0 }: { label: string; value: string | number; hint?: string; alert?: boolean; index?: number }) {
  const tone = alert ? "var(--status-critical)" : TONES[index % TONES.length];
  return (
    <div
      className="sb-enter sb-lift relative overflow-hidden rounded-xl border border-[color:var(--brand-border)] bg-white p-4 shadow-card"
      style={{ ["--sb-i" as string]: index }}
    >
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: tone }} aria-hidden />
      <span
        className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full opacity-[0.08]"
        style={{ background: tone }}
        aria-hidden
      />
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-muted)]">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${alert ? "text-[color:var(--status-critical)]" : "text-[color:var(--brand-primary)]"}`}>
        <Value value={value} />
      </p>
      {hint ? <p className="mt-0.5 text-xs text-[color:var(--brand-muted)]">{hint}</p> : null}
    </div>
  );
}
