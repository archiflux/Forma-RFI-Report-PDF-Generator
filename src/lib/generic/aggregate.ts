import { capRows, describeFilters, PDF_SERIES, type DashboardReport } from "@/lib/report/dashboard/model";
import type { BaseRecord, GenericConfig, GenericFilters } from "./types";
import { describeCustom, matchesCustom } from "@/lib/custom/filter";
import { inDateRange } from "@/lib/dashboard/date-range";
import type { FilterDim } from "./types";

// Option values a record contributes for a filter dimension.
export function dimValues<T>(dim: FilterDim<T>, t: T): string[] {
  const v = String(dim.valueOf(t) ?? "");
  return dim.multi ? v.split(", ").map((x) => x.trim()).filter(Boolean) : [v];
}

export function applyGenericFilters<T extends BaseRecord>(items: T[], cfg: GenericConfig<T>, f: GenericFilters): T[] {
  const q = f.search.trim().toLowerCase();
  return items.filter((t) => {
    if (f.projectIds.length && !f.projectIds.includes(t.projectId)) return false;
    for (const dim of cfg.filters) {
      const sel = f.dims[dim.id];
      if (sel?.length && !dimValues(dim, t).some((v) => sel.includes(v))) return false;
    }
    if (cfg.dateFilter && !inDateRange(cfg.dateFilter.get(t), f.from, f.to)) return false;
    if (cfg.customOf && !matchesCustom(cfg.customOf(t), f.custom ?? {})) return false;
    return !q || cfg.searchText(t).toLowerCase().includes(q);
  });
}

export function sortRows<T extends BaseRecord>(items: T[], cfg: GenericConfig<T>, column: number, dir: 1 | -1, now: Date): T[] {
  const col = cfg.columns[column] ?? cfg.columns[0];
  if (!col) return items;
  const key = col.sortValue ?? ((t: T) => col.value(t, now));
  return [...items].sort((a, b) => String(key(a) ?? "").localeCompare(String(key(b) ?? "")) * dir);
}

// Alias helper for redaction: the same name always maps to the same alias.
export function aliaser(): (name: string) => string {
  const m = new Map<string, string>();
  return (name) => {
    if (!m.has(name)) m.set(name, `Person ${m.size + 1}`);
    return m.get(name) as string;
  };
}

export function buildGenericReport<T extends BaseRecord>(input: {
  cfg: GenericConfig<T>;
  items: T[];
  filters: GenericFilters;
  projectNames: Record<string, string>;
  now: Date;
  includeRegister: boolean;
  // Register row cap; the PDF uses the default, CSV passes Infinity.
  maxRegisterRows?: number;
  title?: string;
}): DashboardReport {
  const { cfg, items, filters: f, now } = input;
  const projectCount = new Set(items.map((t) => t.projectId)).size;
  const register = capRows(sortRows(items, cfg, cfg.defaultSort.column, cfg.defaultSort.dir, now), input.maxRegisterRows);
  return {
    title: input.title ?? cfg.title,
    subtitle: `${items.length} ${cfg.noun} across ${projectCount} project${projectCount === 1 ? "" : "s"}`,
    generatedAt: now.toISOString(),
    filters: describeFilters([
      ["Projects", f.projectIds.map((id) => input.projectNames[id] ?? id)],
      ...cfg.filters.map((d): [string, string[]] => [d.label, (f.dims[d.id] ?? []).map((v) => (d.format ? d.format(v) : v))]),
      [`${cfg.dateFilter?.label ?? "Date"} from`, f.from],
      [`${cfg.dateFilter?.label ?? "Date"} to`, f.to],
      ["Search", f.search.trim() || undefined],
      ...describeCustom(f.custom ?? {}),
    ]),
    kpis: cfg.kpis(items, now),
    sections: [
      {
        kind: "trend",
        title: cfg.trend.title,
        series: cfg.trend.series.map((s, i) => ({ key: s.key, label: s.label, colour: s.pdfColour || (PDF_SERIES[i] ?? "#2a78d6") })),
        data: cfg.trend.build(items),
      },
      ...cfg.breakdowns.map((b) => ({ kind: "bars" as const, title: b.title, data: b.build(items, now) })),
      ...(input.includeRegister
        ? [
            {
              kind: "table" as const,
              title: `Register (${items.length})`,
              columns: cfg.columns.map((c) => c.label),
              widths: cfg.columns.map((c) => c.width ?? 1),
              rows: register.rows.map((t) => cfg.columns.map((c) => c.value(t, now))),
              links: register.rows.map((t) => cfg.linkOf(t)),
              totalRows: register.totalRows,
              isRegister: true,
            },
          ]
        : []),
    ],
  };
}
