"use client";

import { Document, Link, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import type { CustomAttributeDef, Rfi } from "@/lib/aps/types";
import type { Brand } from "@/lib/brands";
import { DEFAULT_BRAND } from "@/lib/brands";
import { issueUrl, rfiUrl } from "@/lib/aps/links";
import {
  BUILTIN_COLUMNS,
  formatCustomAttributeValue,
  getBuiltinValue,
  labelForField,
} from "@/lib/rfi/format";
import type { RfiGroup } from "../apply";
import type { FieldId, ReportTemplate } from "../types";
import { customAttrId, isCustomField } from "../types";

export interface DetailPdfInput {
  template: ReportTemplate;
  groups: RfiGroup[];
  customAttributes: CustomAttributeDef[];
  projectName: string;
  projectId?: string;
  brand?: Brand;
  generatedAt?: Date;
  totalBeforeFilter: number;
  totalAfterFilter: number;
  itemKind?: "rfi" | "issue";
}

const PAGE_DIMENSIONS = {
  A4: { width: 595.28, height: 841.89 },
  A3: { width: 841.89, height: 1190.55 },
} as const;

function makeStyles(brand: Brand) {
  return StyleSheet.create({
    page: {
      paddingTop: 40,
      paddingBottom: 56,
      paddingHorizontal: 40,
      fontSize: 9,
      color: brand.ink,
      fontFamily: "Helvetica",
      lineHeight: 1.4,
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
    coverMetaGrid: {
      marginTop: 30,
      flexDirection: "row",
      flexWrap: "wrap",
    },
    coverMetaCell: { width: "50%", marginBottom: 14 },
    coverMetaLabel: {
      fontSize: 8,
      color: brand.muted,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    coverMetaValue: { fontSize: 10, color: brand.ink, marginTop: 2 },

    pageHeader: {
      marginBottom: 18,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
      borderBottomWidth: 1,
      borderBottomColor: "#e5e7eb",
      borderBottomStyle: "solid",
      paddingBottom: 6,
    },
    pageHeaderTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", color: brand.primary },
    pageHeaderMeta: { fontSize: 7, color: brand.muted },

    rfiHeader: {
      marginTop: 4,
      marginBottom: 10,
      paddingBottom: 8,
      borderBottomWidth: 0.5,
      borderBottomColor: "#cbd5e1",
      borderBottomStyle: "solid",
    },
    rfiNumber: {
      fontFamily: "Helvetica-Bold",
      fontSize: 8,
      color: brand.accent,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    rfiTitle: {
      fontSize: 14,
      fontFamily: "Helvetica-Bold",
      color: brand.primary,
      marginTop: 2,
    },
    rfiLink: { fontSize: 8, color: brand.muted, marginTop: 2 },

    metaGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      marginBottom: 10,
    },
    metaCell: {
      width: "33.333%",
      paddingRight: 8,
      marginBottom: 8,
    },
    metaCellWide: {
      width: "100%",
      paddingRight: 0,
      marginBottom: 8,
    },
    metaLabel: {
      fontSize: 7,
      color: brand.muted,
      textTransform: "uppercase",
      letterSpacing: 0.6,
      fontFamily: "Helvetica-Bold",
    },
    metaValue: { fontSize: 9, color: brand.ink, marginTop: 2 },

    sectionHeading: {
      fontSize: 9,
      fontFamily: "Helvetica-Bold",
      color: brand.primary,
      marginTop: 6,
      marginBottom: 4,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    paragraph: {
      fontSize: 9,
      color: brand.ink,
      marginBottom: 4,
    },
    attachmentsList: {
      marginTop: 2,
    },
    attachmentRow: {
      flexDirection: "row",
      fontSize: 8.5,
      marginBottom: 1.5,
    },
    attachmentBullet: { width: 10, color: brand.muted },
    attachmentName: { flex: 1, color: brand.ink },

    commentBlock: {
      marginTop: 4,
      marginBottom: 6,
      paddingLeft: 8,
      borderLeftWidth: 1.5,
      borderLeftColor: "#e5e7eb",
      borderLeftStyle: "solid",
    },
    commentMeta: {
      fontSize: 7.5,
      color: brand.muted,
      marginBottom: 1,
    },
    commentBody: {
      fontSize: 9,
      color: brand.ink,
    },
    officialBadge: {
      fontSize: 7,
      fontFamily: "Helvetica-Bold",
      color: brand.accent,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },

    rfiSeparator: {
      marginTop: 20,
      marginBottom: 18,
      borderBottomWidth: 0.5,
      borderBottomColor: "#e5e7eb",
      borderBottomStyle: "dashed",
    },

    footer: {
      position: "absolute",
      bottom: 24,
      left: 40,
      right: 40,
      flexDirection: "row",
      justifyContent: "space-between",
      fontSize: 7,
      color: brand.muted,
      borderTopWidth: 0.5,
      borderTopColor: "#e5e7eb",
      borderTopStyle: "solid",
      paddingTop: 6,
    },
  });
}

function formatDate(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}

// Render a single field's value as a string for the meta grid. Built-in
// columns reuse the table renderer; custom attrs go through the formatter.
function fieldValueString(
  rfi: Rfi,
  field: FieldId,
  customAttributes: CustomAttributeDef[],
): string {
  if (isCustomField(field)) {
    const def = customAttributes.find((a) => a.id === customAttrId(field));
    if (!def) return "";
    return formatCustomAttributeValue(def, rfi.customAttributes[def.id]);
  }
  if (BUILTIN_COLUMNS.some((c) => c.id === field)) {
    return getBuiltinValue(rfi, field as (typeof BUILTIN_COLUMNS)[number]["id"]);
  }
  return "";
}

const WIDE_FIELDS = new Set<FieldId>(["question", "officialResponse", "suggestedAnswer", "title"]);

export function DetailPdf({
  template,
  groups,
  customAttributes,
  projectName,
  projectId,
  brand = DEFAULT_BRAND,
  generatedAt = new Date(),
  totalBeforeFilter,
  totalAfterFilter,
  itemKind = "rfi",
}: DetailPdfInput) {
  const styles = makeStyles(brand);
  const size: "A4" | "A3" = template.pageSize === "A3" ? "A3" : "A4";
  const orientation: "portrait" | "landscape" =
    template.orientation === "landscape" ? "landscape" : "portrait";
  const dims = PAGE_DIMENSIONS[size];
  // (Page-width derivation reserved for future fine-tuning of column widths.)
  void (orientation === "landscape" ? dims.height : dims.width);
  const itemNoun = itemKind === "issue" ? "Issue" : "RFI";
  const itemNounPlural = itemKind === "issue" ? "Issues" : "RFIs";
  const linkBase = itemKind === "issue" ? issueUrl : rfiUrl;
  const showComments = template.detailIncludeComments ?? false;

  // Hide the broad question/officialResponse meta cells if they're already
  // selected fields; we render them as full sections lower down.
  const fieldsForMeta = template.fields.filter(
    (f) => f !== "question" && f !== "officialResponse" && f !== "suggestedAnswer",
  );

  return (
    <Document
      title={template.name}
      author={brand.name}
      subject={`${itemNoun} report — ${projectName}`}
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
            <Text style={styles.coverMetaLabel}>{itemNounPlural} in report</Text>
            <Text style={styles.coverMetaValue}>
              {totalAfterFilter.toLocaleString()} of {totalBeforeFilter.toLocaleString()}
            </Text>
          </View>
          <View style={styles.coverMetaCell}>
            <Text style={styles.coverMetaLabel}>Layout</Text>
            <Text style={styles.coverMetaValue}>
              Detail{showComments ? " · with comments" : ""}
            </Text>
          </View>
          <View style={styles.coverMetaCell}>
            <Text style={styles.coverMetaLabel}>Groups</Text>
            <Text style={styles.coverMetaValue}>
              {groups.length > 1 ? String(groups.length) : "—"}
            </Text>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text>{brand.name} · {projectName}</Text>
          <Text
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>

      {/* Detail pages — one section per RFI/Issue, grouped if requested. */}
      <Page size={size} orientation={orientation} style={styles.page}>
        <View style={styles.pageHeader} fixed>
          <Text style={styles.pageHeaderTitle}>{template.name}</Text>
          <Text style={styles.pageHeaderMeta}>
            {projectName} · {generatedAt.toISOString().slice(0, 10)}
          </Text>
        </View>

        {totalAfterFilter === 0 ? (
          <Text style={{ marginTop: 30, fontSize: 10, color: brand.muted, textAlign: "center" }}>
            No {itemNounPlural.toLowerCase()} match the current filters.
          </Text>
        ) : (
          groups.map((group, gi) => (
            <View key={group.key}>
              {groups.length > 1 ? (
                <Text style={styles.sectionHeading}>
                  {group.label} · {group.rfis.length}
                </Text>
              ) : null}

              {group.rfis.map((rfi, ri) => {
                const link = projectId ? linkBase(projectId, rfi.id) : undefined;
                const isLast = ri === group.rfis.length - 1 && gi === groups.length - 1;

                return (
                  <View key={rfi.id} wrap break={ri > 0}>
                    <View style={styles.rfiHeader}>
                      <Text style={styles.rfiNumber}>
                        {rfi.number || rfi.id} · {rfi.statusLabel ?? rfi.status}
                      </Text>
                      <Text style={styles.rfiTitle}>{rfi.title || "(untitled)"}</Text>
                      {link ? (
                        <Link src={link} style={styles.rfiLink}>
                          {link}
                        </Link>
                      ) : null}
                    </View>

                    {/* Meta grid — every selected field except the "wide" ones */}
                    {fieldsForMeta.length > 0 ? (
                      <View style={styles.metaGrid}>
                        {fieldsForMeta.map((f) => {
                          const value = fieldValueString(rfi, f, customAttributes);
                          if (!value) return null;
                          const wide = WIDE_FIELDS.has(f);
                          return (
                            <View
                              key={f}
                              style={wide ? styles.metaCellWide : styles.metaCell}
                            >
                              <Text style={styles.metaLabel}>
                                {labelForField(f, customAttributes)}
                              </Text>
                              <Text style={styles.metaValue}>{value}</Text>
                            </View>
                          );
                        })}
                      </View>
                    ) : null}

                    {rfi.question ? (
                      <View>
                        <Text style={styles.sectionHeading}>Question</Text>
                        <Text style={styles.paragraph}>{rfi.question}</Text>
                      </View>
                    ) : null}

                    {rfi.suggestedAnswer ? (
                      <View>
                        <Text style={styles.sectionHeading}>Suggested answer</Text>
                        <Text style={styles.paragraph}>{rfi.suggestedAnswer}</Text>
                      </View>
                    ) : null}

                    {rfi.officialResponse ? (
                      <View>
                        <Text style={styles.sectionHeading}>Official response</Text>
                        <Text style={styles.paragraph}>{rfi.officialResponse}</Text>
                      </View>
                    ) : null}

                    {rfi.attachments && rfi.attachments.length > 0 ? (
                      <View>
                        <Text style={styles.sectionHeading}>
                          Attachments ({rfi.attachments.length})
                        </Text>
                        <View style={styles.attachmentsList}>
                          {rfi.attachments.map((a) => (
                            <View key={a.id} style={styles.attachmentRow}>
                              <Text style={styles.attachmentBullet}>•</Text>
                              <Text style={styles.attachmentName}>
                                {a.displayName || a.fileName || a.id}
                              </Text>
                            </View>
                          ))}
                        </View>
                        {link ? (
                          <Link src={link} style={[styles.paragraph, { color: brand.primary, fontSize: 8 }]}>
                            Open in Forma →
                          </Link>
                        ) : null}
                      </View>
                    ) : null}

                    {showComments && rfi.comments && rfi.comments.length > 0 ? (
                      <View>
                        <Text style={styles.sectionHeading}>
                          Comments ({rfi.comments.length})
                        </Text>
                        {rfi.comments.map((c) => (
                          <View key={c.id} style={styles.commentBlock}>
                            <Text style={styles.commentMeta}>
                              {c.author?.name ?? "Unknown"}
                              {c.createdAt ? ` · ${formatDate(c.createdAt)}` : ""}
                              {c.isOfficialResponse ? "  " : ""}
                              {c.isOfficialResponse ? (
                                <Text style={styles.officialBadge}>OFFICIAL RESPONSE</Text>
                              ) : null}
                            </Text>
                            <Text style={styles.commentBody}>{c.body}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}

                    {!isLast ? <View style={styles.rfiSeparator} /> : null}
                  </View>
                );
              })}
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

export async function buildDetailPdfBlob(input: DetailPdfInput): Promise<Blob> {
  const instance = pdf(<DetailPdf {...input} />);
  return instance.toBlob();
}
