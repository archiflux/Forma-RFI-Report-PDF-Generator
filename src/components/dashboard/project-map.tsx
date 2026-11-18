"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import type { GeoJSONSource, Map as MlMap, Popup, StyleSpecification } from "maplibre-gl";
import { HEAT_RAMP, type GlobePoint } from "@/lib/dashboard/globe";
import { useWidth } from "@/components/charts/use-width";
import { withBase } from "@/lib/base-path";

// Street map for "Projects on the map": OpenFreeMap vector tiles
// (OpenStreetMap data, free, no API key), restyled to Siteboard's palette.
// Pins close together merge into a numbered cluster that splits apart as
// you zoom in, down to street level.
const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

// Used if the tile service can't be reached: pins on a plain background,
// still zoomable and clickable.
const FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: "background", type: "background", paint: { "background-color": "#eef2f6" } }],
};

const BRAND = { land: "#f3f5f7", water: "#d6e4f1", road: "#ffffff", accent: "#d1c800", ink: "#0e2841" };

function pointsGeoJson(points: GlobePoint[], selected: string[]) {
  return {
    type: "FeatureCollection" as const,
    features: points.map((p) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [p.lon, p.lat] },
      properties: { id: p.id, name: p.name, total: p.total, open: p.open, sel: selected.includes(p.id) },
    })),
  };
}

// Soften the base map towards the brand palette. Layer ids differ between
// styles, so match on type and name.
function restyle(map: MlMap) {
  for (const l of map.getStyle().layers ?? []) {
    try {
      if (l.type === "background") map.setPaintProperty(l.id, "background-color", BRAND.land);
      else if (l.type === "fill" && /water|ocean|sea|lake|river/.test(l.id)) map.setPaintProperty(l.id, "fill-color", BRAND.water);
      else if (l.type === "line" && /water|river|stream/.test(l.id)) map.setPaintProperty(l.id, "line-color", BRAND.water);
      else if (l.type === "fill" && /landuse|landcover|park|wood|grass/.test(l.id)) map.setPaintProperty(l.id, "fill-opacity", 0.35);
    } catch {
      // A layer that rejects the change keeps its own look.
    }
  }
}

function tip(title: string, rows: Array<[string, string]>): HTMLElement {
  const el = document.createElement("div");
  el.className = "text-xs";
  const h = document.createElement("p");
  h.className = "font-semibold text-[color:var(--brand-primary)]";
  h.textContent = title;
  el.appendChild(h);
  for (const [k, v] of rows) {
    const r = document.createElement("p");
    r.className = "mt-0.5 flex justify-between gap-4 tabular-nums";
    const a = document.createElement("span");
    a.textContent = k;
    const b = document.createElement("span");
    b.textContent = v;
    r.append(a, b);
    el.appendChild(r);
  }
  return el;
}

export function ProjectMap({
  points,
  unmapped,
  selected = [],
  onSelect,
  noun,
  per = "project",
}: {
  points: GlobePoint[];
  unmapped: number;
  selected?: string[];
  onSelect?: (id: string) => void;
  noun: string;
  per?: string;
}) {
  const [boxRef, measured] = useWidth<HTMLDivElement>();
  const H = Math.round(Math.min(560, Math.max(340, (measured || 640) * 0.5)));
  const host = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MlMap | null>(null);
  const [ready, setReady] = useState(false);
  const [offline, setOffline] = useState(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const maxOpen = useMemo(() => Math.max(1, ...points.map((p) => p.open)), [points]);
  const maxTotal = useMemo(() => Math.max(1, ...points.map((p) => p.total)), [points]);
  const data = useMemo(() => pointsGeoJson(points, selected), [points, selected]);
  const dataRef = useRef(data);
  dataRef.current = data;

  // Create the map once; maplibre-gl loads on first use.
  useEffect(() => {
    let cancelled = false;
    let map: MlMap | null = null;
    let popup: Popup | null = null;
    (async () => {
      const ml = await import("maplibre-gl");
      if (cancelled || !host.current) return;
      // MapLibre's background worker, served from our own static files: the
      // bundler can't package it, and the CSP only allows same-origin workers.
      ml.setWorkerUrl(withBase("/maplibre-gl-worker.mjs"));
      let style: StyleSpecification;
      try {
        const res = await fetch(STYLE_URL);
        if (!res.ok) throw new Error();
        style = (await res.json()) as StyleSpecification;
      } catch {
        style = FALLBACK_STYLE;
        setOffline(true);
      }
      if (cancelled || !host.current) return;
      const m = new ml.Map({ container: host.current, style, attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false });
      map = m;
      mapRef.current = m;
      m.touchZoomRotate.disableRotation();
      m.addControl(new ml.NavigationControl({ showCompass: false }), "top-left");
      popup = new ml.Popup({ closeButton: false, closeOnClick: false, offset: 12, maxWidth: "260px" });

      map.on("load", () => {
        if (!map) return;
        restyle(map);
        map.addSource("pins", {
          type: "geojson",
          data: dataRef.current,
          cluster: true,
          clusterRadius: 36,
          clusterMaxZoom: 17,
          clusterProperties: { total: ["+", ["get", "total"]], open: ["+", ["get", "open"]] },
        });
        setReady(true);
        const id = (e: { features?: Array<{ properties?: Record<string, unknown> }> }) => e.features?.[0]?.properties ?? {};

        map.on("click", "clusters", async (e) => {
          const f = e.features?.[0];
          const src = map?.getSource("pins") as GeoJSONSource | undefined;
          if (!f || !src || !map) return;
          const zoom = await src.getClusterExpansionZoom(f.properties?.cluster_id as number);
          map.easeTo({ center: (f.geometry as unknown as { coordinates: [number, number] }).coordinates, zoom: Math.min(zoom, 18) });
        });
        map.on("click", "pins", (e) => {
          const p = id(e);
          if (typeof p.id === "string") onSelectRef.current?.(p.id);
        });
        for (const layer of ["clusters", "pins"]) {
          map.on("mouseenter", layer, () => {
            if (map) map.getCanvas().style.cursor = "pointer";
          });
          map.on("mouseleave", layer, () => {
            if (map) map.getCanvas().style.cursor = "";
            popup?.remove();
          });
        }
        map.on("mousemove", "pins", (e) => {
          const p = id(e);
          if (!map || !popup) return;
          popup
            .setLngLat(e.lngLat)
            .setDOMContent(tip(String(p.name ?? ""), [[`${noun[0]?.toUpperCase()}${noun.slice(1)}`, String(p.total)], ["Open", String(p.open)]]))
            .addTo(map);
        });
        map.on("mousemove", "clusters", (e) => {
          const p = id(e);
          if (!map || !popup) return;
          popup
            .setLngLat(e.lngLat)
            .setDOMContent(tip(`${p.point_count} pins close together`, [[`${noun[0]?.toUpperCase()}${noun.slice(1)}`, String(p.total)], ["Open", String(p.open)], ["Click to zoom in", ""]]))
            .addTo(map);
        });
      });
    })();
    return () => {
      cancelled = true;
      popup?.remove();
      map?.remove();
      mapRef.current = null;
    };
  }, [noun]);

  // Layers depend on the data's range, so (re)build them when it changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    (map.getSource("pins") as GeoJSONSource | undefined)?.setData(data);
    for (const l of ["cluster-count", "clusters", "pins"]) if (map.getLayer(l)) map.removeLayer(l);
    const colour = ["interpolate", ["linear"], ["sqrt", ["/", ["get", "open"], maxOpen]], 0, HEAT_RAMP[0], 0.25, HEAT_RAMP[1], 0.5, HEAT_RAMP[2], 0.75, HEAT_RAMP[3], 1, HEAT_RAMP[4]];
    const radius = ["interpolate", ["linear"], ["sqrt", ["get", "total"]], 1, 7, Math.sqrt(maxTotal), 22];
    map.addLayer({
      id: "clusters",
      type: "circle",
      source: "pins",
      filter: ["has", "point_count"],
      paint: {
        "circle-color": colour as never,
        "circle-radius": ["+", 4, radius] as never,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 3,
        "circle-opacity": 0.92,
      },
    });
    if (map.getStyle().glyphs) {
      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "pins",
        filter: ["has", "point_count"],
        layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 12, "text-font": ["Noto Sans Bold"] },
        paint: { "text-color": "#ffffff" },
      });
    }
    map.addLayer({
      id: "pins",
      type: "circle",
      source: "pins",
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": colour as never,
        "circle-radius": radius as never,
        "circle-stroke-color": ["case", ["get", "sel"], BRAND.accent, "#ffffff"] as never,
        "circle-stroke-width": ["case", ["get", "sel"], 4, 2] as never,
        "circle-opacity": 0.95,
      },
    });
  }, [data, ready, maxOpen, maxTotal]);

  // Frame the pins whenever the set of places changes.
  const placesKey = points.map((p) => p.id).join("|");
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !points.length) return;
    const lons = points.map((p) => p.lon);
    const lats = points.map((p) => p.lat);
    map.fitBounds(
      [
        [Math.min(...lons), Math.min(...lats)],
        [Math.max(...lons), Math.max(...lats)],
      ],
      // Extra room on the right keeps pins clear of the legend box.
      { padding: { top: 50, bottom: 50, left: 70, right: Math.min(300, map.getContainer().clientWidth * 0.35) }, maxZoom: 14, duration: 0 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placesKey, ready]);

  return (
    <div ref={boxRef} className="relative w-full overflow-hidden rounded-xl" style={{ height: H }}>
      {/* Inline position: MapLibre's stylesheet sets .maplibregl-map to relative. */}
      <div ref={host} style={{ position: "absolute", inset: 0 }} aria-label={`Map of ${noun} by ${per}`} role="region" />
      <div className="pointer-events-none absolute right-3 top-3 w-60 max-w-[45%] space-y-2 rounded-lg border border-[color:var(--brand-border)] bg-white/95 p-3 text-[11px] text-[color:var(--brand-ink-soft)] shadow-card">
        <div>
          <p className="font-semibold text-[color:var(--brand-primary)]">Open {noun}</p>
          <div className="mt-1 flex h-2 overflow-hidden rounded-full">
            {HEAT_RAMP.map((c) => (
              <span key={c} className="flex-1" style={{ background: c }} />
            ))}
          </div>
          <div className="mt-0.5 flex justify-between text-[10px] text-[color:var(--brand-muted)]">
            <span>Few</span>
            <span>{maxOpen}</span>
          </div>
        </div>
        <p>
          Dot size shows total {noun} per {per}. Numbered dots are pins close together: zoom in or click one to split it apart
          {onSelect ? ". Click a pin to filter" : ""}.
        </p>
        {unmapped ? (
          <p className="text-[color:var(--brand-muted)]">
            {unmapped} project{unmapped === 1 ? " has" : "s have"} no location set in Forma, so {unmapped === 1 ? "it isn't" : "they aren't"} shown.
          </p>
        ) : null}
        {!points.length ? <p className="text-[color:var(--brand-muted)]">No mapped places in this view.</p> : null}
        {offline ? <p className="text-[color:var(--brand-muted)]">Street map unavailable; showing pins only.</p> : null}
      </div>
    </div>
  );
}
