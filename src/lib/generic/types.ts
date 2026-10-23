// Config-driven dashboards. A module (Reviews, RFIs, ...) supplies a
// loader that turns one project into records plus a config describing its
// filters, KPIs, breakdowns, trend and register; the generic view, PDF
// builder and share panel do the rest.

import type { Count } from "@/lib/dashboard/aggregate";
import type { ReportKpi } from "@/lib/report/dashboard/model";

export interface BaseRecord {
  key: string;
  id: string;
  projectId: string;
  projectName: string;
}

export interface GenericProject {
  id: string;
  name: string;
  count: number;
  unavailable?: boolean;
  error?: string;
}

export interface GenericDataset<T extends BaseRecord> {
  projects: GenericProject[];
  items: T[];
}

export interface FilterDim<T> {
  id: string;
  label: string;
  valueOf: (t: T) => string;
  format?: (v: string) => string;
}

export interface Breakdown<T> {
  title: string;
  build: (items: T[], now: Date) => Count[];
  // Clicking a bar toggles this filter dimension.
  filterId?: string;
}

export interface Column<T> {
  label: string;
  value: (t: T, now: Date) => string;
  sortValue?: (t: T) => string;
  width?: number;
  alert?: (t: T, now: Date) => boolean;
}

export interface GenericConfig<T extends BaseRecord> {
  kind: "reviews" | "rfis";
  title: string;
  noun: string; // plural, lower case: "reviews"
  filters: FilterDim<T>[];
  searchText: (t: T) => string;
  kpis: (items: T[], now: Date) => ReportKpi[];
  trend: {
    title: string;
    series: Array<{ key: string; label: string; colour: string; pdfColour: string }>;
    build: (items: T[]) => Array<{ month: string } & Record<string, number | string>>;
  };
  breakdowns: Breakdown<T>[];
  columns: Column<T>[];
  // Column 0 links to the record in Forma.
  linkOf: (t: T) => string | undefined;
  defaultSort: { column: number; dir: 1 | -1 };
  redactionNote: string;
  redact: (ds: GenericDataset<T>) => GenericDataset<T>;
}

export interface GenericFilters {
  projectIds: string[];
  dims: Record<string, string[]>;
  search: string;
}

export const EMPTY_GENERIC_FILTERS: GenericFilters = { projectIds: [], dims: {}, search: "" };
