"use client";

import { useEffect, useRef, useState } from "react";
import { hasLocations, MAX_THINGS, SHAPES, type Group, type Shape, type Universe3D } from "@/lib/three-d/universe";
import { createUniverse, type PickInfo, type UniverseHandle } from "./universe-engine";

function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2"));
  } catch {
    return false;
  }
}

const PREF_KEY = "siteboard-3d";

function readPref(): { dim?: string; shape?: Shape } {
  try {
    return JSON.parse(window.localStorage.getItem(PREF_KEY) ?? "{}") as { dim?: string; shape?: Shape };
  } catch {
    return {};
  }
}

function writePref(p: { dim: string; shape: Shape }) {
  try {
    window.localStorage.setItem(PREF_KEY, JSON.stringify(p));
  } catch {
    // Storage blocked: the choice just isn't remembered.
  }
}

const SELECT = "min-h-9 rounded-full border border-white/15 bg-white/10 px-3 text-xs text-white backdrop-blur-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d1c800] [&>option]:text-black";

// Full-screen 3D dashboard: every record is a cube that flies into towers,
// a ring, blocks, a timeline, a globe or a galaxy, grouped by the chosen
// field. Rendered into a portal by Open3DButton.
export default function UniverseViewer({ universe, onBack }: { universe: Universe3D; onBack: () => void }) {
  const host = useRef<HTMLDivElement | null>(null);
  const engine = useRef<UniverseHandle | null>(null);
  const shapes = SHAPES.filter((s) => s.id !== "globe" || hasLocations(universe));
  const pref = useRef(readPref());
  const [dim, setDim] = useState(() => (universe.dims.some((d) => d.id === pref.current.dim) ? (pref.current.dim as string) : (universe.dims[0]?.id ?? "")));
  const [shape, setShape] = useState<Shape>(() => (shapes.some((s) => s.id === pref.current.shape) ? (pref.current.shape as Shape) : "towers"));
  const [groups, setGroups] = useState<Group[]>([]);
  const [hover, setHover] = useState<PickInfo | null>(null);
  const [selected, setSelected] = useState<PickInfo | null>(null);
  const [legendOn, setLegendOn] = useState<number | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [keyOpen, setKeyOpen] = useState(true);
  const [spin, setSpin] = useState(true);
  const empty = universe.things.length === 0;

  useEffect(() => {
    const el = host.current;
    if (!el || empty) return;
    if (!webglAvailable()) {
      setFailed("This device or browser doesn't support WebGL 2, so the 3D dashboard can't be shown.");
      return;
    }
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (window.innerWidth < 640) setKeyOpen(false);
    setSpin(!reducedMotion);
    try {
      engine.current = createUniverse(el, universe, { reducedMotion, onHover: setHover, onSelect: setSelected });
    } catch (e) {
      setFailed(e instanceof Error ? e.message : "The 3D dashboard couldn't start.");
    }
    return () => {
      engine.current?.dispose();
      engine.current = null;
    };
  }, [universe, empty]);

  useEffect(() => {
    if (!engine.current) return;
    const g = engine.current.arrange(dim, shape);
    setGroups(g.groups);
    setLegendOn(null);
    setSelected(null);
    engine.current.highlightGroup(null);
    writePref({ dim, shape });
  }, [dim, shape, failed]);

  const toggleLegend = (i: number) => {
    const next = legendOn === i ? null : i;
    setLegendOn(next);
    engine.current?.highlightGroup(next);
  };

  const total = universe.things.length;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#030a14] text-white" role="dialog" aria-modal="true" aria-label={`${universe.title} in 3D`}>
      <div ref={host} className="absolute inset-0" />

      <header className="pointer-events-none relative z-10 flex flex-wrap items-center gap-3 bg-gradient-to-b from-[#030a14]/90 to-transparent px-4 pb-10 pt-4 sm:px-6">
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
          <h2 className="truncate text-lg font-semibold text-white sm:text-xl">
            {universe.title}
            <span className="ml-2 text-sm font-normal text-white/60">
              {total.toLocaleString("en-GB")} {universe.noun}
            </span>
          </h2>
        </div>
        <div className="pointer-events-auto flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <label className="flex items-center gap-2 text-xs text-white/70">
            Organise by
            <select value={dim} onChange={(e) => setDim(e.target.value)} className={SELECT}>
              {universe.dims.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-1 rounded-full border border-white/15 bg-white/5 p-1 backdrop-blur-md" role="radiogroup" aria-label="Shape">
            {shapes.map((s) => (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={shape === s.id}
                onClick={() => setShape(s.id)}
                className={`min-h-7 rounded-full px-3 text-xs transition ${shape === s.id ? "bg-[#d1c800] font-semibold text-[#0e2841]" : "text-white/80 hover:bg-white/10"}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {failed || empty ? (
        <div className="relative z-10 m-auto max-w-sm px-6 text-center text-sm text-white/80">
          {failed ?? `There are no ${universe.noun} to show with the current filters.`}
        </div>
      ) : null}

      {hover && !selected ? (
        <div
          className="pointer-events-none absolute z-20 max-w-[18rem] -translate-x-1/2 -translate-y-[calc(100%+14px)] rounded-xl border border-white/15 bg-[#0b1b2e]/85 px-3 py-2 text-xs shadow-2xl backdrop-blur-md"
          style={{ left: hover.x, top: hover.y }}
        >
          <p className="font-semibold text-white">{hover.thing.title}</p>
          <p className="mt-0.5 text-white/65">{hover.thing.subtitle}</p>
          <p className="mt-1 flex items-center gap-1.5 text-white/80">
            <span className="h-2 w-2 rounded-sm" style={{ background: hover.group.colour }} />
            {hover.group.label}
          </p>
        </div>
      ) : null}

      <aside
        className={`absolute z-20 flex flex-col rounded-2xl border border-white/15 bg-[#0b1b2e]/90 text-sm shadow-2xl backdrop-blur-md transition duration-300
          inset-x-3 bottom-3 max-h-[55vh] sm:inset-x-auto sm:bottom-24 sm:right-4 sm:top-36 sm:max-h-none sm:w-[22rem]
          ${selected ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"}`}
        aria-label="Properties"
        aria-hidden={!selected}
      >
        {selected ? (
          <>
            <div className="flex items-start gap-3 border-b border-white/10 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">Properties</p>
                <p className="mt-1 font-semibold text-white">{selected.thing.title}</p>
                <p className="mt-0.5 text-xs text-white/65">{selected.thing.subtitle}</p>
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/85">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: selected.group.colour }} />
                  {selected.group.label}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelected(null);
                  engine.current?.clearSelection();
                }}
                className="rounded-full px-2 text-lg leading-none text-white/60 hover:text-white" aria-label="Close properties">
                ×
              </button>
            </div>
            <dl className="min-h-0 flex-1 overflow-y-auto px-4 py-3 text-xs">
              {selected.thing.props.map((pr) => (
                <div key={pr.label} className="grid grid-cols-[8.5rem_1fr] gap-2 border-b border-white/5 py-1.5 last:border-0">
                  <dt className="text-white/55">{pr.label}</dt>
                  <dd className="whitespace-pre-line break-words text-white/90">{pr.value}</dd>
                </div>
              ))}
            </dl>
            {selected.thing.href ? (
              <div className="border-t border-white/10 p-3">
                <a
                  href={selected.thing.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-9 items-center rounded-full bg-[#d1c800] px-4 text-xs font-semibold text-[#0e2841] hover:brightness-110"
                >
                  Open in Forma
                </a>
              </div>
            ) : null}
          </>
        ) : null}
      </aside>

      <section
        className="pointer-events-auto absolute left-4 top-36 z-10 w-[15rem] max-w-[calc(100%-2rem)] rounded-2xl border border-white/10 bg-[#0b1b2e]/75 text-xs shadow-xl backdrop-blur-md sm:left-6 sm:top-28"
        aria-label="Colour key"
      >
        <button type="button" onClick={() => setKeyOpen((v) => !v)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left" aria-expanded={keyOpen}>
          <span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">Key</span>
            <span className="ml-2 text-white/85">{universe.dims.find((d) => d.id === dim)?.label}</span>
          </span>
          <span className="text-white/50">{keyOpen ? "–" : "+"}</span>
        </button>
        {keyOpen ? (
          <ul className="max-h-[40vh] overflow-y-auto px-1.5 pb-1.5">
            {groups.map((g, i) => (
              <li key={g.label}>
                <button
                  type="button"
                  onClick={() => toggleLegend(i)}
                  aria-pressed={legendOn === i}
                  className={`flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left transition ${legendOn === i ? "bg-white/15" : "hover:bg-white/10"} ${
                    legendOn !== null && legendOn !== i ? "opacity-45" : ""
                  }`}
                >
                  <span className="h-3 w-3 shrink-0 rounded-sm shadow-[0_0_8px_currentColor]" style={{ background: g.colour, color: g.colour }} />
                  <span className="min-w-0 flex-1 truncate text-white/90">{g.label}</span>
                  <span className="tabular-nums text-white/60">{g.count.toLocaleString("en-GB")}</span>
                  <span className="w-9 text-right tabular-nums text-white/40">{Math.round((g.count / Math.max(1, total)) * 100)}%</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <footer className="pointer-events-none relative z-10 mt-auto flex flex-wrap items-end gap-3 bg-gradient-to-t from-[#030a14]/90 to-transparent px-4 pb-4 pt-10 sm:px-6">
        <p className="text-xs text-white/50 sm:ml-auto">
          {total >= MAX_THINGS ? `Showing the first ${MAX_THINGS.toLocaleString("en-GB")}. ` : ""}Drag to orbit · Scroll or pinch to zoom · Click a record for its properties
        </p>
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
