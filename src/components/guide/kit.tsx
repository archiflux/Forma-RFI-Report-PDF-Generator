"use client";

import { useEffect, useRef, useState } from "react";

// Building blocks for the animated guide. Every scene is driven by one clock
// (`t`, ms since the scene started), so pausing freezes everything at once.
// Following Holdpoint's motion rules, text is never faded, moved or scaled:
// it appears under a dissolving cover (Reveal), while shapes without text
// (the cursor, bars, ticks, pins, cubes) are free to move.

export const W = 640;
export const H = 400;

export function ease(x: number): number {
  const c = Math.min(1, Math.max(0, x));
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

// 0 -> 1 between `start` and `start + dur`, eased.
export function ramp(t: number, start: number, dur: number): number {
  return ease((t - start) / dur);
}

// A clock that runs while `playing`, and restarts when `resetKey` changes.
export function useClock(playing: boolean, resetKey: string | number): number {
  const [t, setT] = useState(0);
  const acc = useRef(0);
  useEffect(() => {
    acc.current = 0;
    setT(0);
  }, [resetKey]);
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      acc.current += Math.min(100, now - last);
      last = now;
      setT(acc.current);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, resetKey]);
  return t;
}

// Shows its children from time `at`, revealed by Holdpoint's dissolving
// cover. `curtain` must be the colour behind the block.
export function Reveal({
  t,
  at,
  until,
  curtain = "#eef1f2",
  className = "",
  style,
  children,
}: {
  t: number;
  at: number;
  until?: number;
  curtain?: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  if (t < at || (until !== undefined && t >= until)) return null;
  return (
    <div className={`sb-enter ${className}`} style={{ ...style, ["--curtain" as string]: curtain }}>
      {children}
    </div>
  );
}

export interface Waypoint {
  t: number;
  x: number;
  y: number;
  click?: boolean;
}

// The pointer: glides between waypoints and shows a teal ring on clicks.
export function Cursor({ t, path, dark = false }: { t: number; path: Waypoint[]; dark?: boolean }) {
  if (!path.length) return null;
  let x = path[0]!.x;
  let y = path[0]!.y;
  for (let i = 0; i < path.length; i++) {
    const a = path[i]!;
    const b = path[i + 1];
    if (t >= a.t && (!b || t < b.t)) {
      if (!b) {
        x = a.x;
        y = a.y;
      } else {
        // Hold briefly at each point, then glide to the next.
        const travel = Math.min(900, b.t - a.t);
        const k = ramp(t, b.t - travel, travel);
        x = a.x + (b.x - a.x) * k;
        y = a.y + (b.y - a.y) * k;
      }
    }
  }
  const clicks = path.filter((p) => p.click && t >= p.t && t < p.t + 550);
  const pressed = path.some((p) => p.click && t >= p.t && t < p.t + 160);
  return (
    <>
      {clicks.map((c) => {
        const k = (t - c.t) / 550;
        return (
          <span
            key={c.t}
            className="pointer-events-none absolute z-40 rounded-full border-2"
            style={{
              left: c.x - 14,
              top: c.y - 14,
              width: 28,
              height: 28,
              borderColor: dark ? "#d1c800" : "#006881",
              transform: `scale(${0.4 + k * 1.3})`,
              opacity: 1 - k,
            }}
          />
        );
      })}
      <svg
        className="pointer-events-none absolute z-50 drop-shadow-[0_2px_3px_rgba(0,0,0,0.35)]"
        width="18"
        height="22"
        viewBox="0 0 18 22"
        style={{ left: x - 2, top: y - 1, transform: `scale(${pressed ? 0.85 : 1})`, transformOrigin: "2px 1px" }}
        aria-hidden
      >
        <path d="M2 1.5v16l4.2-3.8 2.7 6.3 2.8-1.2-2.7-6.2 5.6-.2z" fill="#fff" stroke="#2b3033" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    </>
  );
}

// A tick box that fills and draws its tick from time `at`.
export function Tick({ t, at, x, y }: { t: number; at: number | null; x: number; y: number }) {
  const on = at !== null && t >= at;
  const k = at === null ? 0 : ramp(t, at, 260);
  return (
    <span
      className="absolute flex items-center justify-center border-2"
      style={{
        left: x,
        top: y,
        width: 12,
        height: 12,
        borderColor: on ? "#006881" : "#8a9398",
        background: on ? "#006881" : "#fff",
        transition: "background-color 150ms, border-color 150ms",
      }}
    >
      {on ? (
        <svg width="10" height="10" viewBox="0 0 16 16" aria-hidden>
          <path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="#fff" strokeWidth="2.6" strokeDasharray="16" strokeDashoffset={16 * (1 - k)} />
        </svg>
      ) : null}
    </span>
  );
}
