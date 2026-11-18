"use client";

import type { Map as MlMap, StyleSpecification } from "maplibre-gl";
import { withBase } from "@/lib/base-path";

// Shared set-up for Siteboard's street maps: OpenFreeMap vector tiles
// (OpenStreetMap data, free, no API key), restyled to a light (dashboard)
// or dark (3D view) palette.
export const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

export type MapTheme = "light" | "dark";

const PALETTE: Record<MapTheme, { land: string; water: string; road: string; minor: string; text: string; halo: string; border: string }> = {
  light: { land: "#f3f5f7", water: "#d6e4f1", road: "#ffffff", minor: "#ffffff", text: "", halo: "", border: "" },
  dark: { land: "#0a1a2c", water: "#04101d", road: "#1f3a5a", minor: "#152c45", text: "#9fb4cc", halo: "#030a14", border: "#3a5878" },
};

// Used if the tile service can't be reached: pins on a plain background,
// still zoomable and clickable.
function fallbackStyle(theme: MapTheme): StyleSpecification {
  return {
    version: 8,
    sources: {},
    layers: [{ id: "background", type: "background", paint: { "background-color": theme === "dark" ? "#0a1a2c" : "#eef2f6" } }],
  };
}

// Recolour the base map. Layer ids differ between styles, so match on type
// and name; a layer that rejects a change keeps its own look.
export function restyle(map: MlMap, theme: MapTheme) {
  const c = PALETTE[theme];
  const set = (id: string, prop: string, v: unknown) => {
    try {
      map.setPaintProperty(id, prop as never, v as never);
    } catch {
      // ignore
    }
  };
  for (const l of map.getStyle().layers ?? []) {
    const id = l.id;
    if (l.type === "background") set(id, "background-color", c.land);
    else if (l.type === "fill" && /water|ocean|sea|lake|river/.test(id)) set(id, "fill-color", c.water);
    else if (l.type === "line" && /water|river|stream|canal/.test(id)) set(id, "line-color", c.water);
    else if (l.type === "fill" && /landuse|landcover|park|wood|grass/.test(id)) {
      set(id, "fill-opacity", theme === "dark" ? 0.12 : 0.35);
    } else if (theme === "dark") {
      if (l.type === "fill") {
        set(id, "fill-color", /building/.test(id) ? "#12263d" : c.land);
        set(id, "fill-outline-color", "#12263d");
      } else if (l.type === "line") {
        if (/boundary|admin|border/.test(id)) set(id, "line-color", c.border);
        else if (/motorway|trunk|primary|major/.test(id)) set(id, "line-color", c.road);
        else set(id, "line-color", c.minor);
      } else if (l.type === "symbol") {
        set(id, "text-color", c.text);
        set(id, "text-halo-color", c.halo);
        set(id, "icon-opacity", 0.5);
      }
    }
  }
}

export interface LoadedMap {
  ml: typeof import("maplibre-gl");
  map: MlMap;
  offline: boolean;
}

// Loads maplibre-gl on first use and creates a map in `container`. Returns
// null if `cancelled()` turns true while loading.
export async function createStreetMap(
  container: HTMLElement,
  theme: MapTheme,
  cancelled: () => boolean,
  opts: { controls?: boolean } = {},
): Promise<LoadedMap | null> {
  const ml = await import("maplibre-gl");
  if (cancelled()) return null;
  // MapLibre's background worker, served from our own static files: the
  // bundler can't package it, and the CSP only allows same-origin workers.
  ml.setWorkerUrl(withBase("/maplibre-gl-worker.mjs"));
  let style: StyleSpecification;
  let offline = false;
  try {
    const res = await fetch(STYLE_URL);
    if (!res.ok) throw new Error();
    style = (await res.json()) as StyleSpecification;
  } catch {
    style = fallbackStyle(theme);
    offline = true;
  }
  if (cancelled()) return null;
  const map = new ml.Map({ container, style, attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false });
  map.touchZoomRotate.disableRotation();
  if (opts.controls !== false) map.addControl(new ml.NavigationControl({ showCompass: false }), "top-left");
  map.on("load", () => restyle(map, theme));
  return { ml, map, offline };
}

// Pins close together merge into a numbered cluster that splits apart as
// you zoom in, down to street level.
export const CLUSTER = { cluster: true, clusterRadius: 36, clusterMaxZoom: 17 } as const;

export function fitTo(map: MlMap, coords: Array<[number, number]>, padding: { top: number; bottom: number; left: number; right: number }) {
  if (!coords.length) return;
  const lons = coords.map((c) => c[0]);
  const lats = coords.map((c) => c[1]);
  map.fitBounds(
    [
      [Math.min(...lons), Math.min(...lats)],
      [Math.max(...lons), Math.max(...lats)],
    ],
    { padding, maxZoom: 14, duration: 0 },
  );
}

// Popup body built from text nodes (names come from Forma, so no HTML).
export function tip(title: string, rows: Array<[string, string]>, dark = false): HTMLElement {
  const el = document.createElement("div");
  el.className = "text-xs";
  const h = document.createElement("p");
  h.className = dark ? "font-semibold text-white" : "font-semibold text-[color:var(--brand-primary)]";
  h.textContent = title;
  el.appendChild(h);
  for (const [k, v] of rows) {
    const r = document.createElement("p");
    r.className = `mt-0.5 flex justify-between gap-4 tabular-nums${dark ? " text-white/80" : ""}`;
    const a = document.createElement("span");
    a.textContent = k;
    const b = document.createElement("span");
    b.textContent = v;
    r.append(a, b);
    el.appendChild(r);
  }
  return el;
}
