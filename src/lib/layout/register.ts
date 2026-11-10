// Register columns shared by the on-screen table, the PDF and the CSV: one
// definition per column, so all three always agree.

import { capRows, type ReportSection } from "@/lib/report/dashboard/model";
import type { DashLayout, RegisterSort } from "./layout";

export interface RegisterColumn<T> {
  id: string;
  label: string;
  value: (t: T) => string;
  // Sort key when the display text doesn't sort well (dates, numbers).
  sortValue?: (t: T) => string | number;
  // Makes the cell a link to the record in Forma.
  href?: (t: T) => string | undefined;
  // Highlights the cell (e.g. an overdue due date).
  alert?: (t: T) => boolean;
  // Small tag after the text (e.g. "pinned").
  badge?: (t: T) => string | undefined;
  // Relative width in the PDF.
  width?: number;
  // Shown before the user picks their own columns.
  default?: boolean;
}

export function visibleColumns<T>(all: Array<RegisterColumn<T>>, layout: DashLayout): Array<RegisterColumn<T>> {
  if (layout.columns?.length) {
    const byId = new Map(all.map((c) => [c.id, c]));
    const picked = layout.columns.map((id) => byId.get(id)).filter((c): c is RegisterColumn<T> => Boolean(c));
    if (picked.length) return picked;
  }
  return all.filter((c) => c.default);
}

// The sort in force: the user's, if its column is still shown, else the
// dashboard's default.
export function activeSort<T>(cols: Array<RegisterColumn<T>>, layout: DashLayout, fallback: RegisterSort): RegisterSort {
  if (layout.sort && cols.some((c) => c.id === layout.sort?.col)) return layout.sort;
  return fallback;
}

export function sortItems<T>(items: T[], all: Array<RegisterColumn<T>>, sort: RegisterSort): T[] {
  const col = all.find((c) => c.id === sort.col);
  if (!col) return items;
  const key = col.sortValue ?? col.value;
  const keyed = items.map((t) => ({ t, k: key(t) }));
  keyed.sort((a, b) => {
    const ea = a.k === "" || a.k === undefined || a.k === null;
    const eb = b.k === "" || b.k === undefined || b.k === null;
    // Blanks always last, whichever direction.
    if (ea || eb) return ea === eb ? 0 : ea ? 1 : -1;
    const c = typeof a.k === "number" && typeof b.k === "number" ? a.k - b.k : String(a.k).localeCompare(String(b.k), "en-GB", { numeric: true, sensitivity: "base" });
    return c * sort.dir;
  });
  return keyed.map((x) => x.t);
}

// The register as a report table, with the user's columns and sort.
export function registerSection<T>(input: {
  title: string;
  all: Array<RegisterColumn<T>>;
  items: T[];
  layout: DashLayout;
  defaultSort: RegisterSort;
  maxRows?: number;
}): ReportSection {
  const cols = visibleColumns(input.all, input.layout);
  const sorted = sortItems(input.items, input.all, activeSort(cols, input.layout, input.defaultSort));
  const capped = capRows(sorted, input.maxRows);
  const linkCol = cols.find((c) => c.href);
  // The PDF links the first column; put the linked column first there.
  const ordered = linkCol ? [linkCol, ...cols.filter((c) => c !== linkCol)] : cols;
  return {
    kind: "table",
    id: "register",
    title: input.title,
    columns: ordered.map((c) => c.label),
    widths: ordered.map((c) => c.width ?? 1),
    rows: capped.rows.map((t) => ordered.map((c) => c.value(t))),
    links: capped.rows.map((t) => linkCol?.href?.(t)),
    totalRows: capped.totalRows,
    isRegister: true,
  };
}

// Custom field names present in the data, most used first.
export function customKeys(customs: Array<Record<string, string> | undefined>, limit = 40): string[] {
  const m = new Map<string, number>();
  for (const c of customs) for (const [k, v] of Object.entries(c ?? {})) if (v) m.set(k, (m.get(k) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([k]) => k);
}
