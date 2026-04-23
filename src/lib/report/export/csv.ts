import Papa from "papaparse";
import type { CustomAttributeDef } from "@/lib/aps/types";
import { getFieldDisplay, labelForField } from "@/lib/rfi/format";
import type { RfiGroup } from "../apply";
import type { FieldId, ReportTemplate } from "../types";

// Excel on Windows assumes CP1252 unless the file begins with a BOM. Prepend
// one so UK characters (£, ö, emdash) open cleanly on double-click.
const UTF8_BOM = "﻿";

export interface CsvBuildInput {
  template: ReportTemplate;
  groups: RfiGroup[];
  customAttributes: CustomAttributeDef[];
}

export function buildCsv({ template, groups, customAttributes }: CsvBuildInput): string {
  const fields: FieldId[] = template.fields;
  const header = buildHeader(fields, customAttributes, template.groupBy);
  const rows: string[][] = [];

  for (const group of groups) {
    const groupLabel = template.groupBy ? group.label : undefined;
    for (const rfi of group.rfis) {
      const row = fields.map((f) => getFieldDisplay(rfi, f, customAttributes));
      if (groupLabel !== undefined) row.unshift(groupLabel);
      rows.push(row);
    }
  }

  const csv = Papa.unparse([header, ...rows], {
    newline: "\r\n", // RFC 4180 line terminator — safest across Excel locales.
    quotes: true,
  });
  return `${UTF8_BOM}${csv}`;
}

function buildHeader(
  fields: FieldId[],
  customAttributes: CustomAttributeDef[],
  groupBy: FieldId | undefined,
): string[] {
  const labels = fields.map((f) => labelForField(f, customAttributes));
  if (groupBy) return ["Group", ...labels];
  return labels;
}

export function csvBlob(csv: string): Blob {
  return new Blob([csv], { type: "text/csv;charset=utf-8" });
}
