// Plain-data descriptions of what a 3D view should draw. Panels build one of
// these from the same numbers their 2D chart uses; the three.js engine turns
// it into a scene. Kept free of three.js so it can be unit-tested and so the
// heavy renderer is only loaded when someone opens a 3D view.

import { colourFor } from "@/components/charts/colours";

export interface Datum3D {
  label: string;
  value: number;
  colour: string;
  // Extra text for the tooltip only (e.g. an overdue item's title).
  note?: string;
}

export interface SeriesSpec {
  label: string;
  colour: string;
  values: number[];
}

export interface GridCol {
  label: string;
  colour: string;
}

export interface GlobeSpot {
  label: string;
  lat: number;
  lon: number;
  value: number;
  open: number;
}

export type Scene3D =
  | { kind: "bars"; title: string; unit: string; items: Datum3D[] }
  | { kind: "ring"; title: string; unit: string; items: Datum3D[] }
  | { kind: "blocks"; title: string; unit: string; items: Datum3D[] }
  | { kind: "series"; title: string; unit: string; x: string[]; series: SeriesSpec[] }
  | { kind: "grid"; title: string; unit: string; rows: string[]; cols: GridCol[]; values: number[][] }
  | { kind: "gauge"; title: string; unit: string; value: number; max: number }
  | { kind: "globe"; title: string; unit: string; spots: GlobeSpot[] };

export type SceneKind = Scene3D["kind"];

const MAX_BARS = 30;
const MAX_ROWS = 25;

interface CountLike {
  label: string;
  count: number;
  note?: string;
}

// One colour for a single measure (bar lists); categorical colours when the
// categories are parts of a whole (donut, treemap).
function toData(data: CountLike[], limit: number, colour?: string): Datum3D[] {
  return data
    .filter((d) => Number.isFinite(d.count) && d.count > 0)
    .slice(0, limit)
    .map((d, i) => ({
      label: d.label,
      value: d.count,
      colour: colour && d.label !== "Other" ? colour : colourFor(i, d.label),
      ...(d.note ? { note: d.note } : {}),
    }));
}

export function barsScene(title: string, unit: string, data: CountLike[], colour = "var(--series-1)"): Scene3D {
  return { kind: "bars", title, unit, items: toData(data, MAX_BARS, colour) };
}

export function ringScene(title: string, unit: string, data: CountLike[]): Scene3D {
  return { kind: "ring", title, unit, items: toData(data, 12) };
}

export function blocksScene(title: string, unit: string, data: CountLike[]): Scene3D {
  return { kind: "blocks", title, unit, items: toData(data, 40) };
}

export function seriesScene(
  title: string,
  unit: string,
  rows: Array<{ month: string }>,
  series: Array<{ key: string; label: string; colour: string }>,
): Scene3D {
  return {
    kind: "series",
    title,
    unit,
    x: rows.map((r) => r.month),
    series: series.map((s) => ({
      label: s.label,
      colour: s.colour,
      values: rows.map((r) => {
        const v = Number((r as unknown as Record<string, unknown>)[s.key]);
        return Number.isFinite(v) ? v : 0;
      }),
    })),
  };
}

// Rows are sorted by their total so the tallest stand at the front; only the
// largest MAX_ROWS are drawn to keep the scene readable.
export function gridScene(title: string, unit: string, rows: Array<{ label: string; values: number[] }>, cols: GridCol[]): Scene3D {
  const kept = [...rows]
    .map((r) => ({ ...r, values: r.values.map((v) => (Number.isFinite(v) ? v : 0)) }))
    .sort((a, b) => b.values.reduce((s, v) => s + v, 0) - a.values.reduce((s, v) => s + v, 0))
    .slice(0, MAX_ROWS);
  return { kind: "grid", title, unit, rows: kept.map((r) => r.label), cols, values: kept.map((r) => r.values) };
}

export function gaugeScene(title: string, unit: string, value: number | null): Scene3D | null {
  if (value === null || !Number.isFinite(value)) return null;
  const target = Math.max(10, value * 1.5);
  const pow = 10 ** Math.floor(Math.log10(target));
  return { kind: "gauge", title, unit, value, max: Math.ceil(target / pow) * pow };
}

export function globeScene(title: string, unit: string, points: Array<{ name: string; lat: number; lon: number; total: number; open: number }>): Scene3D {
  return {
    kind: "globe",
    title,
    unit,
    spots: points
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon) && p.total > 0)
      .map((p) => ({ label: p.name, lat: p.lat, lon: p.lon, value: p.total, open: p.open })),
  };
}

export function isEmptyScene(s: Scene3D): boolean {
  switch (s.kind) {
    case "bars":
    case "ring":
    case "blocks":
      return s.items.length === 0;
    case "series":
      return s.x.length === 0 || s.series.every((x) => x.values.every((v) => v === 0));
    case "grid":
      return s.rows.length === 0;
    case "gauge":
      return false;
    case "globe":
      return s.spots.length === 0;
  }
}

// Latitude/longitude to a point on a sphere, with +Y up and the Greenwich
// meridian facing +Z (the camera's default side).
export function latLonToXYZ(lat: number, lon: number, r: number): [number, number, number] {
  const phi = (lat * Math.PI) / 180;
  const lam = (lon * Math.PI) / 180;
  return [r * Math.cos(phi) * Math.sin(lam), r * Math.sin(phi), r * Math.cos(phi) * Math.cos(lam)];
}

// Height scale shared by the bar-style scenes: the tallest value maps to
// `maxHeight`, with a small floor so tiny values stay visible.
export function heightScale(values: number[], maxHeight: number): (v: number) => number {
  const max = Math.max(1, ...values.filter(Number.isFinite));
  return (v) => (v <= 0 ? 0 : Math.max(maxHeight * 0.02, (v / max) * maxHeight));
}

// ---- adapters from the 2D charts' own data shapes

export function stackedScene(
  title: string,
  unit: string,
  rows: Array<{ month: string } & Record<string, number>>,
  categories: string[],
  colours?: Record<string, string>,
): Scene3D {
  return seriesScene(
    title,
    unit,
    rows,
    categories.map((c, i) => ({ key: c, label: c, colour: colours?.[c] ?? colourFor(i, c) })),
  );
}

export function openClosedScene(title: string, unit: string, rows: Array<{ name: string; open: number; closed: number; overdue: number }>): Scene3D {
  return gridScene(
    title,
    unit,
    rows.map((r) => ({ label: r.name, values: [r.open, r.closed, r.overdue] })),
    [
      { label: "Open", colour: "var(--series-1)" },
      { label: "Closed", colour: "var(--series-other)" },
      { label: "Overdue", colour: "var(--status-critical)" },
    ],
  );
}

export function overdueScene(title: string, rows: Array<{ number: string; title: string; daysOverdue: number }>): Scene3D {
  return barsScene(
    title,
    "days overdue",
    rows.map((r) => (r.number ? { label: `#${r.number.replace(/^#/, "")}`, note: r.title, count: r.daysOverdue } : { label: r.title, count: r.daysOverdue })),
    "var(--status-critical)",
  );
}
