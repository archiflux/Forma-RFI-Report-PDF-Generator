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
  // Everything known about the record, for the properties panel.
  props: Array<{ label: string; value: string }>;
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

export const PITCH = 1; // slot size; the engine draws cubes slightly smaller

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
  // Per-thing size multiplier (globe: one dot per location, others hidden).
  sizes: Float32Array | null;
  // Per-thing hover text replacing the record's own (globe locations).
  notes: Array<{ title: string; subtitle: string }> | null;
  labels: Label3D[];
  centre: [number, number, number];
  radius: number;
  floor: boolean;
  spin: boolean;
  // Draw records as glowing dots rather than cubes (globe, galaxy).
  dots: boolean;
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

// Square footprint (side in cubes) shared by every stack so heights
// compare. Round sizes make layers easy to count: 10 x 10 means each layer
// is 100 records.
export function footprint(maxCount: number): number {
  if (maxCount >= 400) return 10;
  if (maxCount >= 60) return 5;
  if (maxCount >= 8) return 2;
  return 1;
}

function setPos(out: Float32Array, i: number, x: number, y: number, z: number) {
  out[i * 3] = x;
  out[i * 3 + 1] = y;
  out[i * 3 + 2] = z;
}

const pct = (n: number, total: number) => `${Math.round((n / Math.max(1, total)) * 100)}%`;

// Towers on a neat grid, largest groups in the back row so they never hide
// smaller ones. Every tower has the same footprint, so heights compare.
export function layoutTowers(things: Thing3D[], g: Grouping): Layout {
  const n = things.length;
  const pos = new Float32Array(n * 3);
  const G = Math.max(1, g.groups.length);
  const s = footprint(Math.max(...g.groups.map((x) => x.count), 1));
  const towerW = s * PITCH;
  const step = towerW + Math.max(1.5, towerW * 0.6);
  const cols = G <= 6 ? G : Math.ceil(Math.sqrt(G * 2));
  const rows = Math.ceil(G / cols);
  const xz = g.groups.map((_, gi) => {
    const r = Math.floor(gi / cols);
    const c = gi % cols;
    const inRow = r === rows - 1 ? G - r * cols : cols;
    return [(c - (inRow - 1) / 2) * step, (r - (rows - 1) / 2) * step] as const;
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
    return { text: gr.label, sub: `${gr.count.toLocaleString("en-GB")} · ${pct(gr.count, n)}`, x, y: h + 0.8, z, colour: gr.colour };
  });
  const radius = Math.max(8, cols * step * 0.55, rows * step * 0.5, maxH * 0.8);
  return { pos, up: null, sizes: null, notes: null, labels, centre: [0, maxH * 0.35, 0], radius, floor: true, spin: false, dots: false, camDir: [0, 0.55, 1] };
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
  return { pos, up: null, sizes: null, notes: null, labels, centre: [0, 0, 0], radius: outer * 1.45, floor: true, spin: false, dots: false, camDir: [0, 1.1, 1] };
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
  return { pos, up: null, sizes: null, notes: null, labels, centre: [0, maxH * 0.3, 0], radius: Math.max(8, Math.hypot(W, D) * 0.55), floor: true, spin: false, dots: false, camDir: [0.3, 1, 1] };
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
export const MAX_MONTHS = 120;

export function monthLabel(m: string): string {
  const [y, mo] = m.split("-");
  const d = new Date(Number(y), Number(mo) - 1, 1);
  return Number.isNaN(d.getTime()) ? m : d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

// A stacked area chart built from cubes: one column per month, columns
// touching and one cube deep so every record can be seen from the side.
// Records stack in group order, so each group forms a horizontal stratum
// whose thickness rises and falls month by month. Beyond MAX_MONTHS the
// oldest months fold into an "Earlier" column at the start; only records
// with no date at all go in the "No date" column at the end.
export function layoutTimeline(things: Thing3D[], g: Grouping): Layout {
  const n = things.length;
  const pos = new Float32Array(n * 3);
  const dated = things.map((t) => t.month).filter((m): m is string => Boolean(m && MONTH_RE.test(m))).sort();
  const all = dated.length ? monthsBetween(dated[0] as string, dated[dated.length - 1] as string) : [];
  const earlier = all.length > MAX_MONTHS;
  const months = earlier ? all.slice(-MAX_MONTHS) : all;
  const first = months[0] ?? "";
  // Columns: [Earlier] + months + [No date]
  const off = earlier ? 1 : 0;
  const idx = new Map(months.map((m, i) => [m, i + off]));
  const undatedCol = off + months.length;
  const B = undatedCol + 1;
  const bucketOf = (i: number): number => {
    const m = things[i]?.month;
    if (!m || !MONTH_RE.test(m)) return undatedCol;
    return idx.get(m) ?? (m < first ? 0 : undatedCol);
  };
  const counts = new Int32Array(B);
  for (let i = 0; i < n; i++) {
    const b = bucketOf(i);
    counts[b] = (counts[b] as number) + 1;
  }
  const maxCount = Math.max(1, ...counts);
  // Column width (in cubes) so the tallest column is roughly half as tall as
  // the chart is wide.
  const k = Math.max(1, Math.ceil(Math.sqrt(maxCount / (0.5 * Math.max(1, months.length + off)))));
  const colW = k * PITCH;
  const gapCol = colW * 1.5;
  const xRaw = (b: number) => b * colW + (earlier && b > 0 ? gapCol : 0) + (b === undatedCol ? gapCol : 0);
  const lastX = xRaw(counts[undatedCol] ? undatedCol : undatedCol - 1);
  const xOf = (b: number) => xRaw(b) - lastX / 2;
  const seen = new Int32Array(B);
  let maxH = 0;
  for (const i of g.order) {
    const b = bucketOf(i);
    const q = seen[b] as number;
    seen[b] = q + 1;
    const layer = Math.floor(q / k);
    setPos(pos, i, xOf(b) + ((q % k) - (k - 1) / 2) * PITCH, (layer + 0.5) * PITCH, 0);
    maxH = Math.max(maxH, (layer + 1) * PITCH);
  }
  const every = Math.max(1, Math.ceil(months.length / 12));
  const labels: Label3D[] = [];
  const z = PITCH * 0.5 + 1.5;
  if (earlier && counts[0]) labels.push({ text: `Before ${monthLabel(first)}`, sub: (counts[0] ?? 0).toLocaleString("en-GB"), x: xOf(0), y: 0, z });
  months.forEach((m, mi) => {
    if (mi % every && mi !== months.length - 1) return;
    const b = mi + off;
    labels.push({ text: monthLabel(m), sub: (counts[b] ?? 0).toLocaleString("en-GB"), x: xOf(b), y: 0, z });
  });
  if (counts[undatedCol]) labels.push({ text: "No date", sub: (counts[undatedCol] ?? 0).toLocaleString("en-GB"), x: xOf(undatedCol), y: 0, z });
  return { pos, up: null, sizes: null, notes: null, labels, centre: [0, maxH * 0.45, 0], radius: Math.max(8, lastX * 0.5, maxH * 0.9), floor: true, spin: false, dots: false, camDir: [0, 0.25, 1] };
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

// Dot diameter for a location holding `count` records, relative to the
// globe: grows with the cube root, so a site with 1,000 issues is about
// four times wider than one with a single issue.
export function dotSize(count: number, R: number): number {
  return R * (0.006 + 0.0035 * Math.cbrt(Math.max(1, count)));
}

// One glowing dot per project location, sized by how many records it
// holds. Every record still flies there (so the morph reads), but only one
// per location stays visible; the rest shrink away inside it. Records
// without coordinates gather in a single dot beside the globe.
export function layoutGlobe(things: Thing3D[], g: Grouping, locations: Universe3D["locations"], noun = "records"): Layout {
  const n = things.length;
  const pos = new Float32Array(n * 3);
  const up = new Float32Array(n * 3);
  const sizes = new Float32Array(n);
  const notes: Array<{ title: string; subtitle: string }> = new Array(n);
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
  // The dot takes the colour of the location's most common group, and the
  // hover text lists the top groups there.
  const describe = (list: number[]) => {
    const c = new Map<number, number>();
    for (const i of list) c.set(g.groupOf[i] as number, (c.get(g.groupOf[i] as number) ?? 0) + 1);
    const ranked = [...c.entries()].sort((a, b) => b[1] - a[1]);
    const rep = list.find((i) => g.groupOf[i] === ranked[0]?.[0]) ?? (list[0] as number);
    const top = (ranked.length > 1 ? ranked : [])
      .slice(0, 3)
      .map(([gi, k]) => `${g.groups[gi]?.label ?? ""} ${k.toLocaleString("en-GB")}`)
      .join(" · ");
    return { rep, sub: `${list.length.toLocaleString("en-GB")} ${noun}${top ? ` · ${top}` : ""}` };
  };
  const ranked = [...byProject.entries()].sort((a, b) => b[1].length - a[1].length);
  const spread = spreadOnSphere(
    ranked.map(([pid]) => {
      const loc = locations[pid] as { lat: number; lon: number };
      return latLonToXYZ(loc.lat, loc.lon, 1);
    }),
    // Only resolve heavy overlaps so dots stay close to their real place.
    ranked.map(([, list]) => (dotSize(list.length, R) * 0.3) / R),
  );
  const labels: Label3D[] = [];
  let cx = 0;
  let cy = 0;
  let cz = 0;
  ranked.forEach(([, list], ri) => {
    const nrm = spread[ri] as [number, number, number];
    cx += nrm[0] * list.length;
    cy += nrm[1] * list.length;
    cz += nrm[2] * list.length;
    const d = dotSize(list.length, R);
    const h = R + d / 2;
    const { rep, sub } = describe(list);
    const name = things[list[0] as number]?.projectName ?? "";
    for (const i of list) {
      setPos(pos, i, nrm[0] * h, nrm[1] * h, nrm[2] * h);
      up[i * 3] = nrm[0];
      up[i * 3 + 1] = nrm[1];
      up[i * 3 + 2] = nrm[2];
      notes[i] = { title: name, subtitle: sub };
    }
    sizes[rep] = d;
    if (labels.length < 8) {
      const top = R + d + 0.6;
      labels.push({ text: name, sub: list.length.toLocaleString("en-GB"), x: nrm[0] * top, y: nrm[1] * top, z: nrm[2] * top });
    }
  });
  if (loose.length) {
    const d = dotSize(loose.length, R);
    const x = R * 1.45 + d / 2;
    const { rep, sub } = describe(loose);
    for (const i of loose) {
      setPos(pos, i, x, 0, 0);
      up[i * 3 + 1] = 1;
      notes[i] = { title: "No location set", subtitle: sub };
    }
    sizes[rep] = d;
    labels.push({ text: "No location", sub: loose.length.toLocaleString("en-GB"), x, y: d / 2 + 0.6, z: 0 });
  }
  const cl = Math.hypot(cx, cy, cz);
  const dir: [number, number, number] = cl > 0 ? [cx / cl, cy / cl + 0.3, cz / cl] : [0, 0.3, 1];
  // When every located project sits in one region (say, all in the UK),
  // fly in close to that region instead of framing the whole planet.
  if (cl > 0 && !loose.length) {
    const c: [number, number, number] = [cx / cl, cy / cl, cz / cl];
    let angle = 0;
    let biggest = 0;
    ranked.forEach(([, list], ri) => {
      const v = spread[ri] as [number, number, number];
      angle = Math.max(angle, Math.acos(Math.min(1, v[0] * c[0] + v[1] * c[1] + v[2] * c[2])));
      biggest = Math.max(biggest, dotSize(list.length, R));
    });
    if (angle < 0.5) {
      const view = Math.max(R * 0.14, R * angle * 1.4 + biggest * 3);
      return { pos, up, sizes, notes, labels, centre: [c[0] * R, c[1] * R, c[2] * R], radius: view, floor: false, spin: false, dots: true, camDir: [c[0], c[1] + 0.35, c[2]] };
    }
  }
  return { pos, up, sizes, notes, labels, centre: [loose.length ? R * 0.3 : 0, 0, 0], radius: R * (loose.length ? 1.7 : 1.35), floor: false, spin: true, dots: true, camDir: dir };
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
  return { pos, up: null, sizes: null, notes: null, labels: [], centre: [0, 0, 0], radius: 12 + Math.sqrt(n) * 1.1, floor: false, spin: true, dots: true, camDir: [0, 0.85, 1] };
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
      return layoutGlobe(u.things, g, u.locations, u.noun);
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
