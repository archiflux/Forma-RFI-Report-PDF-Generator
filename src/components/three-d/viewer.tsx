"use client";

import { useEffect, useRef, useState } from "react";
import { isEmptyScene, type Scene3D } from "@/lib/three-d/spec";
import { createEngine, type EngineHandle, type HoverInfo } from "./engine";

function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
}

function legendOf(spec: Scene3D): Array<{ label: string; colour: string }> {
  switch (spec.kind) {
    case "series":
      return spec.series.map((s) => ({ label: s.label, colour: s.colour }));
    case "grid":
      return spec.cols.map((c) => ({ label: c.label, colour: c.colour }));
    case "globe":
      return [
        { label: "Mostly open", colour: "var(--series-2)" },
        { label: "Mostly closed", colour: "var(--series-3)" },
      ];
    case "ring":
    case "blocks":
      return spec.items.slice(0, 8).map((d) => ({ label: d.label, colour: d.colour }));
    default:
      return [];
  }
}

// Full-screen 3D view of one panel's data. Rendered into a portal by
// View3DButton; `onBack` returns to the dashboard.
export default function Viewer3D({ spec, onBack }: { spec: Scene3D; onBack: () => void }) {
  const host = useRef<HTMLDivElement | null>(null);
  const engine = useRef<EngineHandle | null>(null);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [spin, setSpin] = useState(true);
  const empty = isEmptyScene(spec);

  useEffect(() => {
    const el = host.current;
    if (!el || empty) return;
    if (!webglAvailable()) {
      setFailed("This device or browser doesn't support WebGL, so the 3D view can't be shown.");
      return;
    }
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    setSpin(!reducedMotion);
    try {
      engine.current = createEngine(el, spec, { onHover: setHover, reducedMotion, onReady: () => setReady(true) });
    } catch (e) {
      setFailed(e instanceof Error ? e.message : "The 3D view couldn't start.");
    }
    return () => {
      engine.current?.dispose();
      engine.current = null;
    };
  }, [spec, empty]);

  const legend = legendOf(spec);

  return (
    <div className="sb3d fixed inset-0 z-[100] flex flex-col bg-[#030a14] text-white" role="dialog" aria-modal="true" aria-label={`${spec.title} in 3D`}>
      <div ref={host} className="absolute inset-0" />

      <div
        className={`pointer-events-none absolute inset-0 bg-[#030a14] transition-opacity duration-700 ${ready || failed || empty ? "opacity-0" : "opacity-100"}`}
        aria-hidden
      />

      <header className="pointer-events-none relative z-10 flex flex-wrap items-start gap-3 bg-gradient-to-b from-[#030a14]/90 to-transparent px-4 pb-10 pt-4 sm:px-6">
        <button
          type="button"
          onClick={onBack}
          className="pointer-events-auto inline-flex min-h-10 items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 text-sm font-medium backdrop-blur-md transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d1c800]"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
            <path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to dashboard
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
            Bailey Partnership <span className="font-wordmark normal-case tracking-wide text-[#d1c800]">Siteboard 3D</span>
          </p>
          <h2 className="truncate text-lg font-semibold text-white sm:text-xl">{spec.title}</h2>
        </div>
      </header>

      {failed || empty ? (
        <div className="relative z-10 m-auto max-w-sm px-6 text-center text-sm text-white/80">
          {failed ?? "There's no data to show in 3D with the current filters."}
        </div>
      ) : null}

      {hover ? (
        <div
          className="pointer-events-none absolute z-20 max-w-[16rem] -translate-x-1/2 -translate-y-[calc(100%+14px)] rounded-xl border border-white/15 bg-[#0b1b2e]/85 px-3 py-2 text-xs shadow-2xl backdrop-blur-md"
          style={{ left: hover.x, top: hover.y }}
        >
          <p className="font-semibold text-white">{hover.label}</p>
          <p className="mt-0.5 tabular-nums text-white/75">{hover.detail}</p>
        </div>
      ) : null}

      <footer className="pointer-events-none relative z-10 mt-auto flex flex-wrap items-end gap-3 bg-gradient-to-t from-[#030a14]/90 to-transparent px-4 pb-4 pt-10 sm:px-6">
        {legend.length ? (
          <ul className="flex max-w-full flex-wrap gap-x-4 gap-y-1.5 text-xs text-white/80">
            {legend.map((l) => (
              <li key={l.label} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm shadow-[0_0_8px_currentColor]" style={{ background: l.colour, color: l.colour }} />
                {l.label}
              </li>
            ))}
          </ul>
        ) : null}
        <p className="text-xs text-white/50 sm:ml-auto">Drag to orbit · Scroll or pinch to zoom · Right-drag or two fingers to pan · Tap a shape for details</p>
        <div className="pointer-events-auto flex gap-2">
          <button
            type="button"
            onClick={() => {
              const next = !spin;
              setSpin(next);
              engine.current?.setAutoRotate(next);
            }}
            className="min-h-9 rounded-full border border-white/15 bg-white/10 px-3 text-xs backdrop-blur-md hover:bg-white/20"
          >
            {spin ? "Pause rotation" : "Rotate"}
          </button>
          <button
            type="button"
            onClick={() => engine.current?.resetView()}
            className="min-h-9 rounded-full border border-white/15 bg-white/10 px-3 text-xs backdrop-blur-md hover:bg-white/20"
          >
            Reset view
          </button>
        </div>
      </footer>
    </div>
  );
}
