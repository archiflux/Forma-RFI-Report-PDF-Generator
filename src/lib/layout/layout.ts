// A dashboard's layout: which panels are hidden, and the register's columns
// and sort. It drives the screen, the PDF report and shared links, and is
// saved with project sets.

import type { DashboardReport, ReportSection } from "@/lib/report/dashboard/model";
import type { SnapshotKind } from "@/lib/share/types";

export type DashKind = SnapshotKind;

export interface RegisterSort {
  col: string;
  dir: 1 | -1;
}

export interface DashLayout {
  hidden: string[];
  // Visible register columns, in order. Absent = the dashboard's defaults.
  columns?: string[];
  sort?: RegisterSort;
}

export const EMPTY_LAYOUT: DashLayout = { hidden: [] };

const strings = (v: unknown, max: number): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.length <= 200).slice(0, max) : [];

// Accepts only the expected shape (used for stored sets and shared links).
export function sanitiseLayout(v: unknown): DashLayout | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const out: DashLayout = { hidden: strings(o.hidden, 100) };
  if (Array.isArray(o.columns)) out.columns = strings(o.columns, 100);
  const s = o.sort as Record<string, unknown> | undefined;
  if (s && typeof s.col === "string" && (s.dir === 1 || s.dir === -1)) out.sort = { col: s.col.slice(0, 200), dir: s.dir };
  return out;
}

export function isHidden(layout: DashLayout, id: string): boolean {
  return layout.hidden.includes(id);
}

export function toggleHidden(layout: DashLayout, id: string): DashLayout {
  return { ...layout, hidden: isHidden(layout, id) ? layout.hidden.filter((x) => x !== id) : [...layout.hidden, id] };
}

// Drops hidden panels (and the key figures if hidden) from a report.
export function applyLayoutToReport(report: DashboardReport, layout: DashLayout): DashboardReport {
  const hidden = new Set(layout.hidden);
  return {
    ...report,
    kpis: hidden.has("kpis") ? [] : report.kpis,
    sections: report.sections.filter((s: ReportSection) => !s.id || !hidden.has(s.id)),
  };
}

// The last layout used on each dashboard, so it survives a reload even
// without a saved project set. Per browser; holds no project data.
const KEY = (kind: DashKind) => `siteboard:layout:${kind}`;

export function loadLastLayout(kind: DashKind): DashLayout {
  try {
    const raw = window.localStorage.getItem(KEY(kind));
    return (raw && sanitiseLayout(JSON.parse(raw))) || EMPTY_LAYOUT;
  } catch {
    return EMPTY_LAYOUT;
  }
}

export function saveLastLayout(kind: DashKind, layout: DashLayout): void {
  try {
    window.localStorage.setItem(KEY(kind), JSON.stringify(layout));
  } catch {
    // Storage blocked: the layout just isn't remembered.
  }
}
