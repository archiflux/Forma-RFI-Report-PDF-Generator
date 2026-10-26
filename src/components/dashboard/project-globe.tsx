"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { geoDistance, geoGraticule10, geoOrthographic, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import { fitView, heatColour, HEAT_RAMP, type GlobePoint } from "@/lib/dashboard/globe";
import { ChartTooltip, type TooltipState } from "./chart-tooltip";
import { useWidth } from "@/components/charts/use-width";


type Land = FeatureCollection<Geometry>;
let landCache: Promise<Land> | null = null;

// Country outlines load on first use (about 240 KB gzipped) so pages
// without a globe don't pay for them.
function loadLand(): Promise<Land> {
  landCache ??= import("world-atlas/countries-50m.json").then((m) => {
    const topo = (m.default ?? m) as unknown as Parameters<typeof feature>[0] & { objects: { countries: Parameters<typeof feature>[1] } };
    return feature(topo, topo.objects.countries) as unknown as Land;
  });
  return landCache;
}

export function ProjectGlobe({
  points,
  unmapped,
  selected = [],
  onSelect,
  noun,
}: {
  points: GlobePoint[];
  unmapped: number;
  selected?: string[];
  onSelect?: (projectId: string) => void;
  noun: string;
}) {
  const [land, setLand] = useState<Land | null>(null);
  // Fill the panel: width from the container, height in proportion.
  const [boxRef, measured] = useWidth<HTMLDivElement>();
  const W = Math.max(300, measured || 640);
  const H = Math.round(Math.min(560, Math.max(340, W * 0.5)));
  const R = Math.min(W, H) / 2 - 12;
  const fit = useMemo(() => fitView(points), [points]);
  const [view, setView] = useState(() => ({ ...fit, zoom: 1 }));
  const anim = useRef<number | null>(null);
  const [tip, setTip] = useState<TooltipState | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; lon: number; lat: number; moved: boolean } | null>(null);
  // Set when the last gesture was a drag, so its pointerup isn't a click.
  const justDragged = useRef(false);

  useEffect(() => {
    void loadLand().then(setLand);
  }, []);
  // Open on the whole world, then fly in to the projects. Re-runs when the
  // set of mapped projects changes, and on Reset.
  function flyTo(target: { lon: number; lat: number; zoom: number }) {
    if (anim.current) cancelAnimationFrame(anim.current);
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setView(target);
      return;
    }
    const from = { lon: target.lon + 70, lat: Math.max(-60, Math.min(60, target.lat - 15)), zoom: 1 };
    const start = performance.now();
    const ms = 2200;
    const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
    const step = (t: number) => {
      const k = Math.min(1, Math.max(0, (t - start) / ms));
      // Turn first, then zoom, so the projects stay in view as it closes in.
      const turn = ease(k / 0.55);
      const zoom = ease((k - 0.35) / 0.65);
      setView({
        lon: from.lon + (target.lon - from.lon) * turn,
        lat: from.lat + (target.lat - from.lat) * turn,
        zoom: Math.exp(Math.log(from.zoom) + (Math.log(target.zoom) - Math.log(from.zoom)) * zoom),
      });
      anim.current = k < 1 ? requestAnimationFrame(step) : null;
    };
    anim.current = requestAnimationFrame(step);
  }
  const fitKey = points.map((p) => p.id).join(",");
  useEffect(() => {
    flyTo(fit);
    return () => {
      if (anim.current) cancelAnimationFrame(anim.current);
    };
  }, [fitKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Wheel zoom needs a non-passive listener to stop the page scrolling.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (anim.current) {
        cancelAnimationFrame(anim.current);
        anim.current = null;
      }
      setView((v) => ({ ...v, zoom: Math.min(60, Math.max(1, v.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15))) }));
    };
    // iOS Safari fires its own pinch gesture events; cancel them over the
    // globe so pinching zooms the globe, not the page.
    const stopGesture = (e: Event) => e.preventDefault();
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("gesturestart", stopGesture);
    el.addEventListener("gesturechange", stopGesture);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("gesturestart", stopGesture);
      el.removeEventListener("gesturechange", stopGesture);
    };
  }, []);

  const projection = useMemo(
    () => geoOrthographic().scale(R * view.zoom).translate([W / 2, H / 2]).rotate([-view.lon, -view.lat]).clipAngle(90),
    [view, W, H, R],
  );
  const path = useMemo(() => geoPath(projection), [projection]);
  const maxTotal = Math.max(1, ...points.map((p) => p.total));
  const maxOpen = Math.max(0, ...points.map((p) => p.open));
  const radius = (total: number) => 4 + 14 * Math.sqrt(total / maxTotal);
  const visible = points
    .filter((p) => geoDistance([p.lon, p.lat], [view.lon, view.lat]) < Math.PI / 2)
    .sort((a, b) => b.total - a.total); // big dots underneath small ones

  // Active pointers, for two-finger pinch and pan on touch screens.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number; mid: { x: number; y: number }; lon: number; lat: number } | null>(null);

  function stopAnim() {
    if (anim.current) {
      cancelAnimationFrame(anim.current);
      anim.current = null;
    }
  }

  // Degrees of rotation per screen pixel at the current zoom, so the point
  // under the finger or cursor roughly follows it.
  function degPerPx(zoom: number): number {
    const box = svgRef.current?.getBoundingClientRect();
    const k = box && box.width ? W / box.width : 1;
    return (k * 180) / (Math.PI * R * zoom);
  }

  function pinchState() {
    const [a, b] = [...pointers.current.values()];
    if (!a || !b) return null;
    return { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
  }

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    stopAnim();
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      // Second finger down: switch from drag to pinch.
      const st = pinchState();
      for (const id of pointers.current.keys()) e.currentTarget.setPointerCapture(id);
      if (st) pinch.current = { ...st, zoom: view.zoom, lon: view.lon, lat: view.lat };
      drag.current = null;
      justDragged.current = true;
      return;
    }
    // Capture only once the pointer moves (below), so a plain click or tap
    // still reaches the project dot under it.
    drag.current = { x: e.clientX, y: e.clientY, lon: view.lon, lat: view.lat, moved: false };
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const p = pinch.current;
    if (p && pointers.current.size >= 2) {
      const st = pinchState();
      if (!st) return;
      const zoom = Math.min(60, Math.max(1, p.zoom * (st.dist / p.dist)));
      const deg = degPerPx(zoom);
      setView({
        zoom,
        lon: p.lon - (st.mid.x - p.mid.x) * deg,
        lat: Math.max(-89, Math.min(89, p.lat + (st.mid.y - p.mid.y) * deg)),
      });
      return;
    }
    const d = drag.current;
    if (!d) return;
    const deg = degPerPx(view.zoom);
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.abs(dx) + Math.abs(dy) > 3) {
      d.moved = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    if (!d.moved) return;
    setView((v) => ({ ...v, lon: d.lon - dx * deg, lat: Math.max(-89, Math.min(89, d.lat + dy * deg)) }));
  }

  function onPointerUp(e: React.PointerEvent<SVGSVGElement>) {
    pointers.current.delete(e.pointerId);
    if (pinch.current) {
      if (pointers.current.size < 2) pinch.current = null;
      // One finger left after a pinch: carry on as a drag from where it is,
      // without jumping.
      const rest = [...pointers.current.values()][0];
      drag.current = rest ? { x: rest.x, y: rest.y, lon: view.lon, lat: view.lat, moved: true } : null;
      return;
    }
    justDragged.current = drag.current?.moved ?? false;
    drag.current = null;
  }

  const zoomBy = (f: number) => {
    stopAnim();
    setView((v) => ({ ...v, zoom: Math.min(60, Math.max(1, v.zoom * f)) }));
  };

  return (
    <div ref={boxRef} className="relative" onMouseLeave={() => setTip(null)}>
      <ChartTooltip tip={tip} />
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full cursor-grab touch-pan-y select-none rounded-lg active:cursor-grabbing"
          role="img"
          aria-label={`Globe of projects sized by ${noun} and coloured by open ${noun}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <defs>
            <radialGradient id="globe-ocean" cx="40%" cy="35%" r="70%">
              <stop offset="0%" stopColor="#f4f8fd" />
              <stop offset="100%" stopColor="#dce8f6" />
            </radialGradient>
            <filter id="globe-glow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="5" />
            </filter>
          </defs>
          <path d={path({ type: "Sphere" }) ?? ""} fill="url(#globe-ocean)" stroke="#c9d6e6" />
          <path d={path(geoGraticule10()) ?? ""} fill="none" stroke="#c9d6e6" strokeWidth={0.5} />
          {land ? <path d={path(land) ?? ""} fill="#e9ecef" stroke="#b7c0ca" strokeWidth={0.5} /> : null}
          {visible.map((p) => {
            const xy = projection([p.lon, p.lat]);
            if (!xy) return null;
            const r = radius(p.total);
            const colour = heatColour(p.open, maxOpen);
            const dim = selected.length > 0 && !selected.includes(p.id);
            return (
              <g
                key={p.id}
                opacity={dim ? 0.3 : 1}
                className={onSelect ? "cursor-pointer" : undefined}
                onClick={() => {
                  if (onSelect && !justDragged.current) onSelect(p.id);
                }}
                onMouseMove={(e) => {
                  const box = (e.currentTarget.closest(".relative") as HTMLElement | null)?.getBoundingClientRect();
                  if (!box) return;
                  setTip({
                    x: e.clientX - box.left,
                    y: e.clientY - box.top,
                    title: p.name,
                    rows: [
                      { label: `${noun[0]?.toUpperCase()}${noun.slice(1)}`, value: String(p.total) },
                      { label: "Open", value: String(p.open), colour },
                    ],
                  });
                }}
                onMouseLeave={() => setTip(null)}
              >
                <circle cx={xy[0]} cy={xy[1]} r={r * 1.6} fill={colour} opacity={0.45} filter="url(#globe-glow)" />
                <circle cx={xy[0]} cy={xy[1]} r={r} fill={colour} fillOpacity={0.85} stroke="#ffffff" strokeWidth={1.5} />
              </g>
            );
          })}
        </svg>

        <div className="absolute left-3 top-3 flex gap-2">
            <button type="button" className="rounded-md border border-[color:var(--brand-border)] bg-white/90 px-2.5 py-1 text-xs shadow-sm" onClick={() => zoomBy(1.5)} aria-label="Zoom in">+</button>
            <button type="button" className="rounded-md border border-[color:var(--brand-border)] bg-white/90 px-2.5 py-1 text-xs shadow-sm" onClick={() => zoomBy(1 / 1.5)} aria-label="Zoom out">−</button>
            <button type="button" className="rounded-md border border-[color:var(--brand-border)] bg-white/90 px-2.5 py-1 text-xs shadow-sm" onClick={() => flyTo(fit)}>Reset</button>
          </div>
        <div className="mt-3 space-y-3 text-xs text-[color:var(--brand-ink-soft)] md:absolute md:right-3 md:top-3 md:mt-0 md:w-64 md:rounded-lg md:border md:border-[color:var(--brand-border)] md:bg-white/90 md:p-3 md:shadow-sm">
          <div>
            <p className="font-semibold text-[color:var(--brand-primary)]">Open {noun}</p>
            <div className="mt-1 flex h-2 overflow-hidden rounded">
              {HEAT_RAMP.map((c) => <span key={c} className="flex-1" style={{ background: c }} />)}
            </div>
            <div className="mt-0.5 flex justify-between text-[10px] text-[color:var(--brand-muted)]">
              <span>Few</span>
              <span>{maxOpen}</span>
            </div>
          </div>
          <p>
            Dot size shows total {noun} per project. Drag to spin, scroll or use +/− to zoom{onSelect ? ", click a project to filter" : ""}. On a
            phone, pinch with two fingers to zoom.
          </p>
          {unmapped ? (
            <p className="text-[color:var(--brand-muted)]">
              {unmapped} project{unmapped === 1 ? " has" : "s have"} no location set in Forma, so {unmapped === 1 ? "it isn't" : "they aren't"} shown.
            </p>
          ) : null}
          {!points.length ? <p className="text-[color:var(--brand-muted)]">No mapped projects in this view.</p> : null}
        </div>
      </div>
    </div>
  );
}
