"use client";

import { Document, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import type { CustomAttributeDef } from "@/lib/aps/types";
import type { Brand } from "@/lib/brands";
import { DEFAULT_BRAND } from "@/lib/brands";
import { getFieldDisplay, labelForField } from "@/lib/rfi/format";
import type { RfiGroup } from "../apply";
import type { FieldId, ReportTemplate } from "../types";

export interface PdfBuildInput {
  template: ReportTemplate;
  groups: RfiGroup[];
  customAttributes: CustomAttributeDef[];
  projectName: string;
  brand?: Brand;
  generatedAt?: Date;
  totalBeforeFilter: number;
  totalAfterFilter: number;
}

function makeStyles(brand: Brand) {
  return StyleSheet.create({
    page: {
      paddingTop: 40,
      paddingBottom: 48,
      paddingHorizontal: 36,
      fontSize: 9,
      color: brand.ink,
      fontFamily: "Helvetica",
    },
    accentRule: {
      height: 3,
      backgroundColor: brand.accent,
      width: 64,
      marginBottom: 10,
    },
    brandEyebrow: {
      color: brand.accent,
      fontSize: 8,
      textTransform: "uppercase",
      letterSpacing: 1.2,
      fontFamily: "Helvetica-Bold",
    },
    coverTitle: {
      fontSize: 24,
      fontFamily: "Helvetica-Bold",
      marginTop: 4,
      color: brand.primary,
    },
    coverProject: {
      fontSize: 14,
      marginTop: 18,
      color: brand.ink,
    },
    coverMetaLabel: {
      fontSize: 8,
      color: brand.muted,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    coverMetaValue: {
      fontSize: 10,
      color: brand.ink,
      marginTop: 2,
    },
    coverMetaGrid: {
      marginTop: 30,
      flexDirection: "row",
      flexWrap: "wrap",
    },
    coverMetaCell: {
      width: "50%",
      marginBottom: 14,
    },
    filterSummary: {
      marginTop: 24,
      padding: 14,
      backgroundColor: "#f8f9fb",
      borderLeftWidth: 3,
      borderLeftColor: brand.primary,
      borderLeftStyle: "solid",
    },
    filterSummaryHeader: {
      fontSize: 8,
      color: brand.muted,
      textTransform: "uppercase",
      letterSpacing: 1,
      fontFamily: "Helvetica-Bold",
    },
    filterSummaryLine: {
      fontSize: 10,
      marginTop: 4,
      color: brand.ink,
    },
    pageHeader: {
      marginBottom: 12,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
      borderBottomWidth: 1,
      borderBottomColor: "#e5e7eb",
      borderBottomStyle: "solid",
      paddingBottom: 6,
    },
    pageHeaderTitle: {
      fontSize: 9,
      fontFamily: "Helvetica-Bold",
      color: brand.primary,
    },
    pageHeaderMeta: {
      fontSize: 7,
      color: brand.muted,
    },
    groupHeader: {
      fontSize: 10,
      fontFamily: "Helvetica-Bold",
      color: brand.primary,
      marginTop: 14,
      marginBottom: 6,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    table: {
      borderTopWidth: 0.5,
      borderTopColor: "#cbd5e1",
      borderTopStyle: "solid",
    },
    tableRow: {
      flexDirection: "row",
      borderBottomWidth: 0.5,
      borderBottomColor: "#e5e7eb",
      borderBottomStyle: "solid",
    },
    tableRowHeader: {
      backgroundColor: "#f1f5f9",
    },
    tableCell: {
      padding: 4,
      fontSize: 8,
      lineHeight: 1.3,
    },
    tableCellHeader: {
      fontSize: 7.5,
      fontFamily: "Helvetica-Bold",
      color: brand.primary,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    footer: {
      position: "absolute",
      bottom: 24,
      left: 36,
      right: 36,
      flexDirection: "row",
      justifyContent: "space-between",
      fontSize: 7,
      color: brand.muted,
      borderTopWidth: 0.5,
      borderTopColor: "#e5e7eb",
      borderTopStyle: "solid",
      paddingTop: 6,
    },
    noRows: {
      marginTop: 30,
      fontSize: 10,
      color: brand.muted,
      textAlign: "center",
    },
  });
}

function describeFilter(
  template: ReportTemplate,
  customAttributes: CustomAttributeDef[],
): string[] {
  const f = template.filter;
  const lines: string[] = [];
  if (f.search) lines.push(`Search contains “${f.search}”`);
  if (f.status?.length) lines.push(`Status: ${f.status.join(", ")}`);
  if (f.assigneeContains) lines.push(`Assignee contains “${f.assigneeContains}”`);
  if (f.dueDate?.gte || f.dueDate?.lte)
    lines.push(`Due ${f.dueDate.gte ?? "…"} → ${f.dueDate.lte ?? "…"}`);
  if (f.createdAt?.gte || f.createdAt?.lte)
    lines.push(`Created ${f.createdAt.gte ?? "…"} → ${f.createdAt.lte ?? "…"}`);
  if (f.customAttributes) {
    for (const [attrId, clause] of Object.entries(f.customAttributes)) {
      const def = customAttributes.find((a) => a.id === attrId);
      const name = def?.name ?? attrId;
      const parts: string[] = [];
      if (clause.contains) parts.push(`contains “${clause.contains}”`);
      if (clause.range?.gte !== undefined || clause.range?.lte !== undefined)
        parts.push(`${clause.range?.gte ?? "…"} → ${clause.range?.lte ?? "…"}`);
      if (clause.values?.length) {
        const labels = clause.values.map(
          (v) => def?.values?.find((x) => x.id === v)?.label ?? v,
        );
        parts.push(`any of ${labels.join(", ")}`);
      }
      if (parts.length) lines.push(`${name}: ${parts.join("; ")}`);
    }
  }
  if (template.sort.length > 0) {
    lines.push(
      `Sort: ${template.sort
        .map((s) => `${labelForField(s.field, customAttributes)} ${s.order}`)
        .join(" → ")}`,
    );
  }
  if (template.groupBy) {
    lines.push(`Grouped by ${labelForField(template.groupBy, customAttributes)}`);
  }
  if (lines.length === 0) lines.push("No filters applied — all RFIs included.");
  return lines;
}

// Column widths are allocated proportionally. Long text columns (title,
// question, response) get more room than codes or dates.
function columnWeights(fields: FieldId[]): number[] {
  return fields.map((f) => {
    if (f === "title") return 3;
    if (f === "question") return 3;
    if (f === "officialResponse") return 3;
    if (f === "statusLabel") return 1.5;
    if (f === "assignee" || f === "manager") return 1.5;
    if (f === "dueDate" || f === "createdAt") return 1.2;
    if (f === "number") return 1.2;
    if (f === "attachmentCount") return 0.8;
    return 1.6; // custom attrs default
  });
}

function percentWidths(fields: FieldId[]): string[] {
  const weights = columnWeights(fields);
  const total = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => `${((w / total) * 100).toFixed(3)}%`);
}

export function ReportPdf({
  template,
  groups,
  customAttributes,
  projectName,
  brand = DEFAULT_BRAND,
  generatedAt = new Date(),
  totalBeforeFilter,
  totalAfterFilter,
}: PdfBuildInput) {
  const styles = makeStyles(brand);
  // @react-pdf/renderer PageSize is case-sensitive: "A4", "LETTER", etc.
  const size: "A4" | "LETTER" = template.pageSize === "Letter" ? "LETTER" : "A4";
  const orientation = template.orientation ?? "portrait";
  const widths = percentWidths(template.fields);
  const filterLines = describeFilter(template, customAttributes);

  return (
    <Document
      title={template.name}
      author={brand.name}
      subject={`RFI report — ${projectName}`}
    >
      {/* Cover page */}
      <Page size={size} orientation={orientation} style={styles.page}>
        <View>
          <View style={styles.accentRule} />
          <Text style={styles.brandEyebrow}>{brand.name}</Text>
          <Text style={styles.coverTitle}>{template.name}</Text>
          <Text style={styles.coverProject}>{projectName}</Text>
        </View>

        <View style={styles.coverMetaGrid}>
          <View style={styles.coverMetaCell}>
            <Text style={styles.coverMetaLabel}>Generated</Text>
            <Text style={styles.coverMetaValue}>
              {generatedAt.toISOString().slice(0, 10)}
            </Text>
          </View>
          <View style={styles.coverMetaCell}>
            <Text style={styles.coverMetaLabel}>RFIs in report</Text>
            <Text style={styles.coverMetaValue}>
              {totalAfterFilter.toLocaleString()} of {totalBeforeFilter.toLocaleString()}
            </Text>
          </View>
          <View style={styles.coverMetaCell}>
            <Text style={styles.coverMetaLabel}>Columns</Text>
            <Text style={styles.coverMetaValue}>{template.fields.length}</Text>
          </View>
          <View style={styles.coverMetaCell}>
            <Text style={styles.coverMetaLabel}>Groups</Text>
            <Text style={styles.coverMetaValue}>
              {groups.length > 1 ? `${groups.length}` : "—"}
            </Text>
          </View>
        </View>

        <View style={styles.filterSummary}>
          <Text style={styles.filterSummaryHeader}>Applied filters</Text>
          {filterLines.map((line, i) => (
            <Text key={i} style={styles.filterSummaryLine}>
              • {line}
            </Text>
          ))}
        </View>

        <View style={styles.footer} fixed>
          <Text>{brand.name} · {projectName}</Text>
          <Text
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>

      {/* Data pages */}
      <Page size={size} orientation={orientation} style={styles.page}>
        <View style={styles.pageHeader} fixed>
          <Text style={styles.pageHeaderTitle}>{template.name}</Text>
          <Text style={styles.pageHeaderMeta}>
            {projectName} · {generatedAt.toISOString().slice(0, 10)}
          </Text>
        </View>

        {totalAfterFilter === 0 ? (
          <Text style={styles.noRows}>No RFIs match the current filters.</Text>
        ) : (
          groups.map((group) => (
            <View key={group.key}>
              {groups.length > 1 ? (
                <Text style={styles.groupHeader}>
                  {group.label} · {group.rfis.length}
                </Text>
              ) : null}
              <View style={styles.table}>
                {/* Column headers (repeat on every page via `fixed`). */}
                <View style={[styles.tableRow, styles.tableRowHeader]} fixed>
                  {template.fields.map((f, i) => (
                    <Text
                      key={f}
                      style={[styles.tableCell, styles.tableCellHeader, { width: widths[i] }]}
                    >
                      {labelForField(f, customAttributes)}
                    </Text>
                  ))}
                </View>
                {group.rfis.map((rfi) => (
                  <View key={rfi.id} style={styles.tableRow} wrap={false}>
                    {template.fields.map((f, i) => (
                      <Text key={f} style={[styles.tableCell, { width: widths[i] }]}>
                        {getFieldDisplay(rfi, f, customAttributes)}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            </View>
          ))
        )}

        <View style={styles.footer} fixed>
          <Text>{brand.name} · {projectName}</Text>
          <Text
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}

export async function buildPdfBlob(input: PdfBuildInput): Promise<Blob> {
  // pdf() returns an instance; toBlob() renders to a browser Blob.
  const instance = pdf(<ReportPdf {...input} />);
  return instance.toBlob();
}
