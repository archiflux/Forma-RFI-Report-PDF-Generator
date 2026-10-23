// A dashboard report is a plain description of what a dashboard is showing
// (KPIs, bar breakdowns, trends, tables) after the viewer's filters. Every
// dashboard builds one; a single PDF renderer draws them all.

import type { Count } from "@/lib/dashboard/aggregate";

export interface ReportKpi {
  label: string;
  value: string;
  alert?: boolean;
}

export type ReportSection =
  | { kind: "bars"; title: string; data: Count[] }
  | {
      kind: "trend";
      title: string;
      series: Array<{ key: string; label: string; colour: string }>;
      data: Array<{ month: string } & Record<string, number | string>>;
    }
  | {
      kind: "table";
      title: string;
      columns: string[];
      // Relative column widths (flex weights); equal when omitted.
      widths?: number[];
      rows: string[][];
      // Optional per-row Forma URL, rendered as a link on the first column.
      links?: Array<string | undefined>;
      // Total rows before any cap, so the PDF can say "first N of M".
      totalRows?: number;
      // The dashboard's main register; CSV export uses this table.
      isRegister?: boolean;
    };

export interface DashboardReport {
  title: string;
  subtitle: string;
  generatedAt: string;
  filters: string[];
  kpis: ReportKpi[];
  sections: ReportSection[];
}

// Hex equivalents of the --series-* CSS tokens (react-pdf has no CSS vars).
export const PDF_SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100"] as const;

export const MAX_PDF_TABLE_ROWS = 2000;

export function capRows<T>(rows: T[], max: number = MAX_PDF_TABLE_ROWS): { rows: T[]; totalRows: number } {
  return { rows: Number.isFinite(max) ? rows.slice(0, max) : rows, totalRows: rows.length };
}

// Human-readable list of active filters for the report header.
export function describeFilters(parts: Array<[string, string[] | string | undefined]>): string[] {
  const out: string[] = [];
  for (const [label, v] of parts) {
    if (Array.isArray(v) ? v.length : v) out.push(`${label}: ${Array.isArray(v) ? v.join(", ") : v}`);
  }
  return out.length ? out : ["No filters (everything loaded)"];
}

// Register as CSV: report columns plus a Forma link column. UTF-8 BOM so
// Excel on Windows reads accents correctly; CRLF line endings.
export function registerCsv(report: DashboardReport): string | null {
  const t = report.sections.find((x) => x.kind === "table" && x.isRegister);
  if (!t || t.kind !== "table") return null;
  const esc = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [[...t.columns, "Forma link"].map(esc).join(",")];
  t.rows.forEach((r, i) => lines.push([...r, t.links?.[i] ?? ""].map(esc).join(",")));
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
