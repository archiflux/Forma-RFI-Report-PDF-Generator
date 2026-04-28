"use client";

import type { CustomAttributeDef } from "@/lib/aps/types";
import { resolveBrand } from "@/lib/brands";
import { applyTemplate } from "../apply";
import type { ReportTemplate } from "../types";
import type { Rfi } from "@/lib/aps/types";
import { buildCsv, csvBlob } from "./csv";
import { downloadBlob, safeFilename } from "./download";
import { loadLogoDataUri } from "./logo";

export type ItemKind = "rfi" | "issue";

export interface ExportInput {
  template: ReportTemplate;
  rfis: Rfi[];
  customAttributes: CustomAttributeDef[];
  projectName: string;
  projectId?: string; // used by Detail layout to embed Forma deep links
  // Drives PDF cover wording ("RFI report" vs "Issue report") and the
  // metadata grid label ("RFIs in report" vs "Issues in report").
  itemKind?: ItemKind;
}

export async function exportReport({
  template,
  rfis,
  customAttributes,
  projectName,
  projectId,
  itemKind = "rfi",
}: ExportInput): Promise<void> {
  const { groups, filtered } = applyTemplate(rfis, template, customAttributes);

  if (template.output === "csv") {
    const csv = buildCsv({
      template,
      groups,
      customAttributes,
      ctx: { projectId, itemKind },
    });
    downloadBlob(csvBlob(csv), safeFilename(template.name, "csv"));
    return;
  }

  // Dynamic-import the PDF modules so @react-pdf/renderer (~400 KB) isn't in
  // the initial bundle. Each layout has its own renderer module so the unused
  // one's components don't ship to clients who only ever pick one variant.
  const layout = template.pdfLayout ?? "table";
  // Preload the brand logo as a data URI so @react-pdf doesn't have to make
  // its own fetch (which can fail under strict CSP or when the renderer
  // worker runs without network). Awaiting in parallel with the dynamic
  // import keeps export start-up snappy.
  const [logoDataUri] = await Promise.all([loadLogoDataUri()]);
  const blob = await (async () => {
    if (layout === "detail") {
      const { buildDetailPdfBlob } = await import("./pdf-detail");
      return buildDetailPdfBlob({
        template,
        groups,
        customAttributes,
        projectName,
        projectId,
        brand: resolveBrand(template.brandId),
        totalBeforeFilter: rfis.length,
        totalAfterFilter: filtered.length,
        itemKind,
        logoDataUri,
      });
    }
    const { buildPdfBlob } = await import("./pdf");
    return buildPdfBlob({
      template,
      groups,
      customAttributes,
      projectName,
      brand: resolveBrand(template.brandId),
      totalBeforeFilter: rfis.length,
      totalAfterFilter: filtered.length,
      itemKind,
      logoDataUri,
    });
  })();
  downloadBlob(blob, safeFilename(template.name, "pdf"));
}
