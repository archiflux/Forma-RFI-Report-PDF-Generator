"use client";

import type { CustomAttributeDef } from "@/lib/aps/types";
import { resolveBrand } from "@/lib/brands";
import { applyTemplate } from "../apply";
import type { ReportTemplate } from "../types";
import type { Rfi } from "@/lib/aps/types";
import { buildCsv, csvBlob } from "./csv";
import { downloadBlob, safeFilename } from "./download";

export interface ExportInput {
  template: ReportTemplate;
  rfis: Rfi[];
  customAttributes: CustomAttributeDef[];
  projectName: string;
}

export async function exportReport({
  template,
  rfis,
  customAttributes,
  projectName,
}: ExportInput): Promise<void> {
  const { groups, filtered } = applyTemplate(rfis, template, customAttributes);

  if (template.output === "csv") {
    const csv = buildCsv({ template, groups, customAttributes });
    downloadBlob(csvBlob(csv), safeFilename(template.name, "csv"));
    return;
  }

  // Dynamic-import the PDF module so @react-pdf/renderer (~400 KB) isn't in
  // the initial bundle. It's only needed on an actual export.
  const { buildPdfBlob } = await import("./pdf");
  const blob = await buildPdfBlob({
    template,
    groups,
    customAttributes,
    projectName,
    brand: resolveBrand(template.brandId),
    totalBeforeFilter: rfis.length,
    totalAfterFilter: filtered.length,
  });
  downloadBlob(blob, safeFilename(template.name, "pdf"));
}
