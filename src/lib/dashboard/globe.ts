import type { ProjectLocation } from "@/lib/aps/project-location";

export interface GlobePoint {
  id: string;
  name: string;
  lat: number;
  lon: number;
  total: number;
  open: number;
}

// One point per project that has coordinates and records, plus a count of
// projects left off the map for lack of coordinates.
export function globePoints<T extends { projectId: string }>(
  items: T[],
  projects: Array<{ id: string; name: string }>,
  locations: Record<string, ProjectLocation | null>,
  isOpen: (t: T) => boolean,
): { points: GlobePoint[]; unmapped: number } {
  const counts = new Map<string, { total: number; open: number }>();
  for (const t of items) {
    const c = counts.get(t.projectId) ?? { total: 0, open: 0 };
    c.total++;
    if (isOpen(t)) c.open++;
    counts.set(t.projectId, c);
  }
  const points: GlobePoint[] = [];
  let unmapped = 0;
  for (const p of projects) {
    const c = counts.get(p.id);
    if (!c) continue;
    const loc = locations[p.id];
    if (!loc) {
      unmapped++;
      continue;
    }
    points.push({ id: p.id, name: p.name, lat: loc.lat, lon: loc.lon, ...c });
  }
  return { points, unmapped };
}

// Initial view: centre on the points and zoom so the furthest sits about
// 80% of the way to the rim. Angles in radians.
export function fitView(points: Array<{ lat: number; lon: number }>): { lon: number; lat: number; zoom: number } {
  if (!points.length) return { lon: 0, lat: 20, zoom: 1 };
  // Mean on the unit sphere, so points either side of 180° average properly.
  let x = 0;
  let y = 0;
  let z = 0;
  for (const p of points) {
    const la = (p.lat * Math.PI) / 180;
    const lo = (p.lon * Math.PI) / 180;
    x += Math.cos(la) * Math.cos(lo);
    y += Math.cos(la) * Math.sin(lo);
    z += Math.sin(la);
  }
  const lon = (Math.atan2(y, x) * 180) / Math.PI;
  const lat = (Math.atan2(z, Math.hypot(x, y)) * 180) / Math.PI;
  const dist = (a: { lat: number; lon: number }) => {
    const r = Math.PI / 180;
    const c = Math.sin(a.lat * r) * Math.sin(lat * r) + Math.cos(a.lat * r) * Math.cos(lat * r) * Math.cos((a.lon - lon) * r);
    return Math.acos(Math.min(1, Math.max(-1, c)));
  };
  const maxD = Math.max(...points.map(dist));
  const zoom = maxD < 1e-4 ? 40 : Math.min(40, Math.max(1, 0.8 / Math.sin(Math.min(maxD, Math.PI / 2))));
  return { lon, lat, zoom };
}

// Sequential blue ramp (dataviz reference palette steps 250-650), light =
// few open items, dark = many.
export const HEAT_RAMP = ["#86b6ef", "#5598e7", "#2a78d6", "#1c5cab", "#104281"] as const;

export function heatColour(open: number, maxOpen: number): string {
  if (maxOpen <= 0) return HEAT_RAMP[0];
  const t = Math.sqrt(open / maxOpen);
  return HEAT_RAMP[Math.min(HEAT_RAMP.length - 1, Math.floor(t * HEAT_RAMP.length))] as string;
}
