// The 3D dashboard draws every record (issue, RFI, form, review) as one
// cube. This module groups the records by a chosen field and works out where
// each cube sits for each shape (towers, ring, blocks, timeline, globe,
// galaxy). It is plain maths with no three.js so it can be unit-tested; the
// engine animates cubes between the positions it returns.

import { squarify } from "@/lib/charts/treemap";

export interface Thing3D {
  key: string;
  title: string;
  // Short reference shown under the title, e.g. "#43 · Riverside School".
  subtitle: string;
  href?: string;
  projectId: string;
  projectName: string;
  month?: string; // YYYY-MM
  groups: Record<string, string>;
}

export interface Dim3D {
  id: string;
  label: string;
}

export interface Universe3D {
  title: string;
  noun: string;
  dims: Dim3D[];
  things: Thing3D[];
  locations: Record<string, { lat: number; lon: number } | null>;
}

export type Shape = "towers" | "ring" | "blocks" | "timeline" | "globe" | "galaxy";

export const SHAPES: Array<{ id: Shape; label: string }> = [
  { id: "towers", label: "Towers" },
  { id: "ring", label: "Ring" },
  { id: "blocks", label: "Blocks" },
  { id: "timeline", label: "Timeline" },
  { id: "globe", label: "Globe" },
  { id: "galaxy", label: "Galaxy" },
];

// Distinct colours for up to 11 groups, then grey for "Other". The first six
// are the dashboard's chart palette so 2D and 3D agree.
export const GROUP_COLOURS = [
  "#2a78d6",
  "#eb6834",
  "#1baf7a",
  "#eda100",
  "#e87ba4",
  "#2fb344",
  "#8b6cf6",
  "#19b8d6",
  "#b8cc2e",
  "#d6457a",
  "#a8774f",
];
export const OTHER_COLOUR = "#8a929c";
const MAX_GROUPS = GROUP_COLOURS.length;

export const PITCH = 1.25; // cube size 1 plus a gap

export interface Group {
  label: string;
  count: number;
  colour: string;
}

export interface Grouping {
  groups: Group[];
  groupOf: Int32Array; // thing index -> group index
  order: number[]; // thing indices sorted by group, so groups stay together
}

// Groups by count, largest first; past MAX_GROUPS everything folds into
// "Other". A month dimension keeps calendar order instead.
export function groupThings(things: Thing3D[], dimId: string): Grouping {
  const counts = new Map<string, number>();
  const valueOf = (t: Thing3D) => t.groups[dimId] || "Not set";
  for (const t of things) counts.set(valueOf(t), (counts.get(valueOf(t)) ?? 0) + 1);
  let ranked: Array<[string, number]>;
  let other = 0;
  let otherLabel = "Other";
  if (dimId === "month") {
    // Calendar order; the most recent months keep their own colour and
    // anything earlier folds into "Earlier".
    const keyOf = new Map<string, string>();
    for (const t of things) keyOf.set(valueOf(t), t.month ?? "9999-99");
    ranked = [...counts.entries()].sort((a, b) => (keyOf.get(a[0]) ?? "").localeCompare(keyOf.get(b[0]) ?? ""));
    if (ranked.length > MAX_GROUPS) {
      const cut = ranked.length - (MAX_GROUPS - 1);
      other = ranked.slice(0, cut).reduce((s, [, c]) => s + c, 0);
      ranked = ranked.slice(cut);
      otherLabel = "Earlier";
    }
  } else {
    ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    if (ranked.length > MAX_GROUPS) {
      other = ranked.slice(MAX_GROUPS - 1).reduce((s, [, c]) => s + c, 0);
      ranked = ranked.slice(0, MAX_GROUPS - 1);
    }
  }
  const groups: Group[] = ranked.map(([label, count], i) => ({ label, count, colour: label === "Other" ? OTHER_COLOUR : (GROUP_COLOURS[i] as string) }));
  if (other) {
    if (otherLabel === "Earlier") groups.unshift({ label: otherLabel, count: other, colour: OTHER_COLOUR });
    else groups.push({ label: otherLabel, count: other, colour: OTHER_COLOUR });
  }
  const index = new Map(groups.map((g, i) => [g.label, i]));
  const otherIdx = index.get(otherLabel) ?? groups.length - 1;
  const groupOf = new Int32Array(things.length);
  things.forEach((t, i) => {
    groupOf[i] = index.get(valueOf(t)) ?? otherIdx;
  });
  const order = things.map((_, i) => i).sort((a, b) => (groupOf[a] as number) - (groupOf[b] as number) || a - b);
  return { groups, groupOf, order };
}

export interface Label3D {
  text: string;
  sub: string;
  x: number;
  y: number;
  z: number;
  colour?: string;
}

export interface Layout {
  pos: Float32Array; // 3 per thing: the cube's centre
  up: Float32Array | null; // 3 per thing: the cube's "up" (globe only)
  labels: Label3D[];
  centre: [number, number, number];
  radius: number;
  floor: boolean;
  spin: boolean;
  camDir: [number, number, number];
}

// Deterministic 0..1 noise from a string, so cubes keep their spots.
export function hash01(s: string, salt = 0): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

// Square footprint (side in cubes) so the tallest stack is about three
// times as tall as it is wide; the same footprint for every stack keeps
// heights in proportion.
export function footprint(maxCount: number): number {
  return Math.max(1, Math.ceil(Math.cbrt(Math.max(1, maxCount) / 3)));
}

function setPos(out: Float32Array, i: number, x: number, y: number, z: number) {
  out[i * 3] = x;
  out[i * 3 + 1] = y;
  out[i * 3 + 2] = z;
}

const pct = (n: number, total: number) => `${Math.round((n / Math.max(1, total)) * 100)}%`;

export function layoutTowers(things: Thing3D[], g: Grouping): Layout {
  const n = things.length;
  const pos = new Float32Array(n * 3);
  const G = Math.max(1, g.groups.length);
  const s = footprint(Math.max(...g.groups.map((x) => x.count), 1));
  const towerW = s * PITCH;
  const gap = Math.max(2.5, towerW * 0.7);
  const step = towerW + gap;
  const span = (G - 1) * step;
  const bend = G > 4 ? 0.22 : 0;
  const xz = g.groups.map((_, gi) => {
    const u = G === 1 ? 0 : gi / (G - 1) - 0.5;
    return [u * span, -(u * u) * span * bend] as const;
  });
  const seen = new Int32Array(G);
  let maxH = 0;
  for (const i of g.order) {
    const gi = g.groupOf[i] as number;
    const k = seen[gi] as number;
    seen[gi] = k + 1;
    const layer = Math.floor(k / (s * s));
    const cell = k % (s * s);
    const [gx, gz] = xz[gi] as readonly [number, number];
    setPos(pos, i, gx + ((cell % s) - (s - 1) / 2) * PITCH, (layer + 0.5) * PITCH, gz + (Math.floor(cell / s) - (s - 1) / 2) * PITCH);
    maxH = Math.max(maxH, (layer + 1) * PITCH);
  }
  const labels = g.groups.map((gr, gi) => {
    const [x, z] = xz[gi] as readonly [number, number];
    const h = Math.ceil(gr.count / (s * s)) * PITCH;
    return { text: gr.label, sub: `${gr.count.toLocaleString("en-GB")} · ${pct(gr.count, n)}`, x, y: h + 1.2, z, colour: gr.colour };
  });
  const radius = Math.max(8, span * 0.55, maxH * 0.9);
  return { pos, up: null, labels, centre: [0, maxH * 0.4, -span * bend * 0.1], radius, floor: true, spin: false, camDir: [0, 0.42, 1] };
}

export function layoutRing(things: Thing3D[], g: Grouping): Layout {
  const n = things.length;
  const pos = new Float32Array(n * 3);
  const L = Math.max(1, Math.round(Math.cbrt(n) / 3.5));
  const needed = Math.ceil(n / L);
  const R0 = Math.max(4, Math.sqrt(needed) * 0.35) * PITCH;
  const slots: Array<{ r: number; a: number }> = [];
  for (let r = R0; slots.length < needed; r += PITCH) {
    const k = Math.max(6, Math.floor((2 * Math.PI * r) / PITCH));
    for (let j = 0; j < k; j++) slots.push({ r, a: (j + 0.5) / k });
  }
  // Clockwise from 12 o'clock across all rings, so groups form wedges.
  const used = slots.slice(0, Math.max(needed, 1));
  used.sort((p, q) => p.a - q.a || p.r - q.r);
  const outer = used.reduce((m, s) => Math.max(m, s.r), R0);
  const angle = (a: number) => Math.PI / 2 - a * Math.PI * 2;
  const groupSlots = g.groups.map(() => [] as number[]);
  g.order.forEach((i, rank) => {
    const slot = used[Math.min(used.length - 1, Math.floor(rank / L))] as { r: number; a: number };
    const layer = rank % L;
    const th = angle(slot.a);
    setPos(pos, i, Math.cos(th) * slot.r, (layer + 0.5) * PITCH, -Math.sin(th) * slot.r);
    groupSlots[g.groupOf[i] as number]?.push(slot.a);
  });
  const labels = g.groups.map((gr, gi) => {
    const as = groupSlots[gi] ?? [];
    const mid = as.length ? (Math.min(...as) + Math.max(...as)) / 2 : 0;
    const th = angle(mid);
    const r = outer + 3;
    return { text: gr.label, sub: `${gr.count.toLocaleString("en-GB")} · ${pct(gr.count, n)}`, x: Math.cos(th) * r, y: 0.5, z: -Math.sin(th) * r, colour: gr.colour };
  });
  labels.push({ text: n.toLocaleString("en-GB"), sub: "total", x: 0, y: L * PITCH + outer * 0.35, z: 0, colour: "" });
  return { pos, up: null, labels, centre: [0, 0, 0], radius: outer * 1.45, floor: true, spin: false, camDir: [0, 1.1, 1] };
}

export function layoutBlocks(things: Thing3D[], g: Grouping): Layout {
  const n = things.length;
  const pos = new Float32Array(n * 3);
  const L = Math.max(1, Math.round(Math.cbrt(n) / 4));
  const area = Math.max(1, Math.ceil(n / L)) * PITCH * PITCH * 1.15;
  const W = Math.sqrt(area * 1.5);
  const D = area / W;
  const rects = squarify(
    g.groups.map((gr, gi) => ({ gi, count: gr.count })),
    (x) => x.count,
    W,
    D,
  );
  const rectOf = new Map(rects.map((r) => [r.item.gi, r]));
  const seen = new Int32Array(g.groups.length);
  let maxH = 0;
  for (const i of g.order) {
    const gi = g.groupOf[i] as number;
    const rc = rectOf.get(gi);
    if (!rc) continue;
    const cols = Math.max(1, Math.floor(rc.w / PITCH));
    const rows = Math.max(1, Math.floor(rc.h / PITCH));
    const k = seen[gi] as number;
    seen[gi] = k + 1;
    const layer = Math.floor(k / (cols * rows));
    const cell = k % (cols * rows);
    const x = rc.x + ((cell % cols) + 0.5) * (rc.w / cols) - W / 2;
    const z = rc.y + (Math.floor(cell / cols) + 0.5) * (rc.h / rows) - D / 2;
    setPos(pos, i, x, (layer + 0.5) * PITCH, z);
    maxH = Math.max(maxH, (layer + 1) * PITCH);
  }
  const labels = rects.map((rc) => {
    const gr = g.groups[rc.item.gi] as Group;
    const cells = Math.max(1, Math.floor(rc.w / PITCH)) * Math.max(1, Math.floor(rc.h / PITCH));
    return {
      text: gr.label,
      sub: `${gr.count.toLocaleString("en-GB")} · ${pct(gr.count, n)}`,
      x: rc.x + rc.w / 2 - W / 2,
      y: Math.ceil(gr.count / cells) * PITCH + 0.8,
      z: rc.y + rc.h / 2 - D / 2,
      colour: gr.colour,
    };
  });
  return { pos, up: null, labels, centre: [0, maxH * 0.3, 0], radius: Math.max(8, Math.hypot(W, D) * 0.55), floor: true, spin: false, camDir: [0.3, 1, 1] };
}

function monthsBetween(a: string, b: string): string[] {
  const out: string[] = [];
  let [y, m] = a.split("-").map(Number) as [number, number];
  const [y2, m2] = b.split("-").map(Number) as [number, number];
  while (y < y2 || (y === y2 && m <= m2)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    if (out.length > 600) break;
  }
  return out;
}

const MONTH_RE = /^\d{4}-\d{2}$/;
export const MAX_MONTHS = 36;

export function monthLabel(m: string): string {
  const [y, mo] = m.split("-");
  const d = new Date(Number(y), Number(mo) - 1, 1);
  return Number.isNaN(d.getTime()) ? m : d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

// One stack per month (the last MAX_MONTHS), coloured by the chosen group,
// with undated or older records in a final stack.
export function layoutTimeline(things: Thing3D[], g: Grouping): Layout {
  const n = things.length;
  const pos = new Float32Array(n * 3);
  const dated = things.map((t) => t.month).filter((m): m is string => Boolean(m && MONTH_RE.test(m))).sort();
  let months = dated.length ? monthsBetween(dated[0] as string, dated[dated.length - 1] as string) : [];
  if (months.length > MAX_MONTHS) months = months.slice(-MAX_MONTHS);
  const idx = new Map(months.map((m, i) => [m, i]));
  const B = months.length + 1;
  const bucketOf = (i: number): number => {
    const m = things[i]?.month;
    return (m ? idx.get(m) : undefined) ?? months.length;
  };
  const counts = new Int32Array(B);
  for (let i = 0; i < n; i++) {
    const b = bucketOf(i);
    counts[b] = (counts[b] as number) + 1;
  }
  const s = footprint(Math.max(1, ...counts));
  const step = s * PITCH + Math.max(0.8, s * 0.35);
  const span = (B - 1) * step;
  const seen = new Int32Array(B);
  let maxH = 0;
  for (const i of g.order) {
    const b = bucketOf(i);
    const k = seen[b] as number;
    seen[b] = k + 1;
    const layer = Math.floor(k / (s * s));
    const cell = k % (s * s);
    const x = -span / 2 + b * step + ((cell % s) - (s - 1) / 2) * PITCH;
    setPos(pos, i, x, (layer + 0.5) * PITCH, (Math.floor(cell / s) - (s - 1) / 2) * PITCH);
    maxH = Math.max(maxH, (layer + 1) * PITCH);
  }
  const every = Math.max(1, Math.ceil(B / 12));
  const labels: Label3D[] = [];
  months.forEach((m, b) => {
    if (b % every && b !== months.length - 1) return;
    labels.push({ text: monthLabel(m), sub: (counts[b] ?? 0).toLocaleString("en-GB"), x: -span / 2 + b * step, y: 0, z: s * PITCH * 0.5 + 2.5 });
  });
  if (counts[months.length]) {
    labels.push({ text: "No date", sub: (counts[months.length] ?? 0).toLocaleString("en-GB"), x: -span / 2 + months.length * step, y: 0, z: s * PITCH * 0.5 + 2.5 });
  }
  return { pos, up: null, labels, centre: [0, maxH * 0.35, 0], radius: Math.max(8, span * 0.4, maxH), floor: true, spin: false, camDir: [0.15, 0.5, 1] };
}

export function latLonToXYZ(lat: number, lon: number, r: number): [number, number, number] {
  const phi = (lat * Math.PI) / 180;
  const lam = (lon * Math.PI) / 180;
  return [r * Math.cos(phi) * Math.sin(lam), r * Math.sin(phi), r * Math.cos(phi) * Math.cos(lam)];
}

export function globeRadius(n: number): number {
  return Math.max(30, Math.sqrt(n) * 2);
}

// Nudges project stacks apart on the sphere until their footprints no
// longer overlap. Projects a few miles apart would otherwise share one
// muddled pile; the map stays roughly right, which is all a 3D view needs.
export function spreadOnSphere(dirs: Array<[number, number, number]>, radii: number[], iterations = 60): Array<[number, number, number]> {
  const v = dirs.map((d) => [...d] as [number, number, number]);
  const P = v.length;
  for (let it = 0; it < iterations; it++) {
    let moved = false;
    for (let i = 0; i < P; i++) {
      for (let j = i + 1; j < P; j++) {
        const a = v[i] as [number, number, number];
        const b = v[j] as [number, number, number];
        const dot = Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]);
        const ang = Math.acos(dot);
        const need = (radii[i] as number) + (radii[j] as number);
        if (ang >= need) continue;
        moved = true;
        // Push each along the great circle away from the other.
        let dx = a[0] - b[0];
        let dy = a[1] - b[1];
        let dz = a[2] - b[2];
        let len = Math.hypot(dx, dy, dz);
        if (len < 1e-9) {
          dx = 1e-3 * (j - i);
          dy = 1e-3;
          dz = 0;
          len = Math.hypot(dx, dy, dz);
        }
        const push = (need - ang) / 2 / len;
        for (const [p, sgn] of [[a, 1], [b, -1]] as const) {
          p[0] += dx * push * sgn;
          p[1] += dy * push * sgn;
          p[2] += dz * push * sgn;
          const l = Math.hypot(p[0], p[1], p[2]);
          p[0] /= l;
          p[1] /= l;
          p[2] /= l;
        }
      }
    }
    if (!moved) break;
  }
  return v;
}

// Stacks of cubes rising out of the globe at each project; records whose
// project has no coordinates orbit in a ring around it.
export function layoutGlobe(things: Thing3D[], g: Grouping, locations: Universe3D["locations"]): Layout {
  const n = things.length;
  const pos = new Float32Array(n * 3);
  const up = new Float32Array(n * 3);
  const R = globeRadius(n);
  const byProject = new Map<string, number[]>();
  const loose: number[] = [];
  for (const i of g.order) {
    const t = things[i] as Thing3D;
    const loc = locations[t.projectId];
    if (loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lon)) {
      const list = byProject.get(t.projectId) ?? [];
      list.push(i);
      byProject.set(t.projectId, list);
    } else loose.push(i);
  }
  const labels: Label3D[] = [];
  let cx = 0;
  let cy = 0;
  let cz = 0;
  const ranked = [...byProject.entries()].sort((a, b) => b[1].length - a[1].length);
  const sideOf = (count: number) => Math.max(1, Math.ceil(Math.cbrt(count / 2)));
  const spread = spreadOnSphere(
    ranked.map(([pid]) => {
      const loc = locations[pid] as { lat: number; lon: number };
      return latLonToXYZ(loc.lat, loc.lon, 1);
    }),
    ranked.map(([, list]) => ((sideOf(list.length) * PITCH) / 2 + PITCH) / R),
  );
  ranked.forEach(([, list], ri) => {
    const nrm = spread[ri] as [number, number, number];
    cx += nrm[0] * list.length;
    cy += nrm[1] * list.length;
    cz += nrm[2] * list.length;
    // Tangent basis at this point on the sphere.
    let ax = nrm[2];
    let az = -nrm[0];
    const al = Math.hypot(ax, az) || 1;
    ax /= al;
    az /= al;
    const bx = nrm[1] * az;
    const by = nrm[2] * ax - nrm[0] * az;
    const bz = -nrm[1] * ax;
    const s = sideOf(list.length);
    list.forEach((i, k) => {
      const layer = Math.floor(k / (s * s));
      const cell = k % (s * s);
      const u = ((cell % s) - (s - 1) / 2) * PITCH;
      const v = (Math.floor(cell / s) - (s - 1) / 2) * PITCH;
      const h = R + (layer + 0.5) * PITCH;
      setPos(pos, i, nrm[0] * h + ax * u + bx * v, nrm[1] * h + by * v, nrm[2] * h + az * u + bz * v);
      up[i * 3] = nrm[0];
      up[i * 3 + 1] = nrm[1];
      up[i * 3 + 2] = nrm[2];
    });
    if (labels.length < 8) {
      const top = R + Math.ceil(list.length / (s * s)) * PITCH + 2;
      const name = things[list[0] as number]?.projectName ?? "";
      labels.push({ text: name, sub: list.length.toLocaleString("en-GB"), x: nrm[0] * top, y: nrm[1] * top, z: nrm[2] * top });
    }
  });
  loose.forEach((i) => {
    const key = (things[i] as Thing3D).key;
    const a = hash01(key, 1) * Math.PI * 2;
    const r = R * (1.55 + hash01(key, 2) * 0.35);
    setPos(pos, i, Math.cos(a) * r, (hash01(key, 3) - 0.5) * PITCH * 1.5, Math.sin(a) * r);
    up[i * 3 + 1] = 1;
  });
  if (loose.length) labels.push({ text: "No location", sub: loose.length.toLocaleString("en-GB"), x: R * 1.95, y: 0, z: 0 });
  const cl = Math.hypot(cx, cy, cz);
  const dir: [number, number, number] = cl > 0 ? [cx / cl, cy / cl + 0.3, cz / cl] : [0, 0.3, 1];
  // When every located project sits in one region (say, all in the UK) and
  // nothing orbits, fly in close to that region instead of framing the
  // whole planet.
  if (cl > 0 && !loose.length) {
    const c: [number, number, number] = [cx / cl, cy / cl, cz / cl];
    let angle = 0;
    let tallest = 0;
    ranked.forEach(([, list], ri) => {
      const v = spread[ri] as [number, number, number];
      angle = Math.max(angle, Math.acos(Math.min(1, v[0] * c[0] + v[1] * c[1] + v[2] * c[2])));
      tallest = Math.max(tallest, (Math.ceil(list.length / sideOf(list.length) ** 2) + 1) * PITCH);
    });
    if (angle < 0.5) {
      const view = Math.max(R * 0.3, R * angle * 1.3 + tallest);
      return { pos, up, labels, centre: [c[0] * R, c[1] * R, c[2] * R], radius: view, floor: false, spin: false, camDir: [c[0], c[1] + 0.35, c[2]] };
    }
  }
  return { pos, up, labels, centre: [0, 0, 0], radius: R * (loose.length ? 2 : 1.35), floor: false, spin: true, camDir: dir };
}

export function layoutGalaxy(things: Thing3D[], g: Grouping): Layout {
  const n = things.length;
  const pos = new Float32Array(n * 3);
  const Rg = 10 + Math.sqrt(n) * 1.3;
  const arms = Math.max(2, Math.min(5, g.groups.length));
  things.forEach((t, i) => {
    const h1 = hash01(t.key, 11);
    const h2 = hash01(t.key, 12);
    const h3 = hash01(t.key, 13);
    const r = Math.sqrt(h1) * Rg;
    const arm = (g.groupOf[i] as number) % arms;
    const th = (arm / arms) * Math.PI * 2 + (r / Rg) * 3.2 + (h2 - 0.5) * 0.7;
    setPos(pos, i, Math.cos(th) * r, (h3 - 0.5) * 3 * (1.2 - r / Rg) * PITCH, Math.sin(th) * r);
  });
  return { pos, up: null, labels: [], centre: [0, 0, 0], radius: Rg * 1.2, floor: false, spin: true, camDir: [0, 0.85, 1] };
}

export function layout(shape: Shape, u: Universe3D, g: Grouping): Layout {
  switch (shape) {
    case "towers":
      return layoutTowers(u.things, g);
    case "ring":
      return layoutRing(u.things, g);
    case "blocks":
      return layoutBlocks(u.things, g);
    case "timeline":
      return layoutTimeline(u.things, g);
    case "globe":
      return layoutGlobe(u.things, g, u.locations);
    case "galaxy":
      return layoutGalaxy(u.things, g);
  }
}

export function hasLocations(u: Universe3D): boolean {
  return u.things.some((t) => u.locations[t.projectId]);
}

// ---- building the universe from each dashboard's records

export function dueStatus(due: string | undefined, open: boolean, now: Date): string {
  if (!open) return "Closed";
  if (!due) return "No due date";
  const today = now.toISOString().slice(0, 10);
  const d = due.slice(0, 10);
  if (d < today) return "Overdue";
  const week = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10);
  return d <= week ? "Due in 7 days" : "Due later";
}

export function monthOf(date: string | undefined): string | undefined {
  const m = date?.slice(0, 7);
  return m && MONTH_RE.test(m) ? m : undefined;
}

export const MAX_THINGS = 15000;
