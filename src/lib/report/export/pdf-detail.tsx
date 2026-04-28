"use client";

import {
  Document,
  Font,
  Image,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer";
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

// Register a global hyphenation callback so @react-pdf can break long
// unbroken strings (URLs, attachment paths, signed-URL query strings,
// custom-id codes) at safe positions. Without this, an 800-char URL in an
// RFI question forces the flexbox layout engine to push coords past
// pdf-lib's serialiser limits, surfacing as
//   "unsupported number: -1.6897464143597548e+22".
// Module-load side-effect is fine — the callback is idempotent and the
// detail PDF module is dynamic-imported only when an export runs.
const HYPHEN_CHUNK = 40;
Font.registerHyphenationCallback((word) => {
  if (word.length <= HYPHEN_CHUNK) return [word];
  return word.match(new RegExp(`.{1,${HYPHEN_CHUNK}}`, "g")) ?? [word];
});

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
  // Bailey Partnership wordmark, pre-fetched as a data URI by the export
  // pipeline so @react-pdf can embed it without a runtime network call.
  // Optional — falls back to a typographic header when missing.
  logoDataUri?: string;
}

const PAGE_DIMENSIONS = {
  A4: { width: 595.28, height: 841.89 },
  A3: { width: 841.89, height: 1190.55 },
} as const;

function makeStyles(brand: Brand) {
  return StyleSheet.create({
    page: {
      paddingTop: 64,
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
    coverHero: {
      backgroundColor: brand.primary,
      paddingTop: 64,
      paddingBottom: 56,
      paddingHorizontal: 56,
    },
    coverLogo: {
      width: 220,
      height: 64,
      objectFit: "contain",
      marginBottom: 32,
    },
    coverAccentBar: {
      height: 6,
      width: 88,
      backgroundColor: brand.accent,
      marginBottom: 22,
    },
    coverTitle: {
      fontSize: 32,
      fontFamily: "Helvetica-Bold",
      color: "#ffffff",
      lineHeight: 1.15,
    },
    coverProject: {
      fontSize: 16,
      marginTop: 14,
      color: "#ffffff",
      opacity: 0.9,
    },
    coverBody: {
      paddingTop: 36,
      paddingHorizontal: 56,
    },
    coverMetaGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
    coverMetaCell: { width: "50%", marginBottom: 18 },
    coverMetaLabel: {
      fontSize: 8,
      color: brand.muted,
      textTransform: "uppercase",
      letterSpacing: 1,
      fontFamily: "Helvetica-Bold",
    },
    coverMetaValue: {
      fontSize: 11,
      color: brand.ink,
      marginTop: 3,
      fontFamily: "Helvetica-Bold",
    },

    // Fixed header — logo on the left, project name on the right.
    pageHeader: {
      position: "absolute",
      top: 24,
      left: 40,
      right: 40,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderBottomWidth: 1,
      borderBottomColor: "#e5e7eb",
      borderBottomStyle: "solid",
      paddingBottom: 8,
    },
    pageHeaderLogo: { width: 80, height: 24, objectFit: "contain" },
    pageHeaderLogoFallback: {
      fontSize: 9,
      fontFamily: "Helvetica-Bold",
      color: brand.primary,
    },
    pageHeaderProject: {
      fontSize: 9,
      fontFamily: "Helvetica-Bold",
      color: brand.primary,
      textAlign: "right",
      maxWidth: "60%",
    },

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
    // Use integer-friendly flex basis instead of fractional percentages —
    // @react-pdf's flex layout can produce out-of-range coords when 33.333%
    // compounds across siblings, surfacing as "unsupported number" errors
    // from the underlying PDF writer.
    metaCell: {
      flexBasis: "33%",
      flexGrow: 1,
      paddingRight: 8,
      marginBottom: 8,
    },
    metaCellWide: {
      flexBasis: "100%",
      flexGrow: 1,
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
    paragraphSmall: {
      fontSize: 8,
      color: brand.primary,
      marginBottom: 4,
    },
    attachmentsList: {
      marginTop: 2,
    },
    attachmentRow: {
      flexDirection: "row",
      fontSize: 9,
      marginBottom: 2,
    },
    attachmentBullet: { width: 10, color: brand.muted },
    attachmentName: { flex: 1, color: brand.ink },

    commentBlock: {
      marginTop: 4,
      marginBottom: 6,
      paddingLeft: 8,
      // Integer border width — non-integer values can hit a "number out of
      // range" path in some pdf-lib serialisers.
      borderLeftWidth: 2,
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

    // Fixed footer — document name (left), page count (centre), generated
    // date (right). Three flex children with equal flex so the centre
    // pageNumber stays centred regardless of the doc-name length.
    footer: {
      position: "absolute",
      bottom: 24,
      left: 40,
      right: 40,
      flexDirection: "row",
      alignItems: "center",
      fontSize: 7.5,
      color: brand.muted,
      borderTopWidth: 0.5,
      borderTopColor: "#e5e7eb",
      borderTopStyle: "solid",
      paddingTop: 6,
    },
    footerLeft: { flex: 1, textAlign: "left" },
    footerCenter: {
      flex: 1,
      textAlign: "center",
      fontFamily: "Helvetica-Bold",
      color: brand.primary,
    },
    footerRight: { flex: 1, textAlign: "right" },
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
  logoDataUri,
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
  const generatedLabel = generatedAt.toISOString().slice(0, 10);

  // Hide the broad question/officialResponse meta cells if they're already
  // selected fields; we render them as full sections lower down.
  const fieldsForMeta = template.fields.filter(
    (f) => f !== "question" && f !== "officialResponse" && f !== "suggestedAnswer",
  );

  const PageHeader = (
    <View style={styles.pageHeader} fixed>
      {logoDataUri ? (
        <Image src={logoDataUri} style={styles.pageHeaderLogo} />
      ) : (
        <Text style={styles.pageHeaderLogoFallback}>{brand.name}</Text>
      )}
      <Text style={styles.pageHeaderProject}>{projectName}</Text>
    </View>
  );

  const PageFooter = (
    <View style={styles.footer} fixed>
      <Text style={styles.footerLeft}>{template.name}</Text>
      <Text
        style={styles.footerCenter}
        render={({ pageNumber, totalPages }) =>
          `Page ${pageNumber} of ${totalPages}`
        }
      />
      <Text style={styles.footerRight}>{generatedLabel}</Text>
    </View>
  );

  return (
    <Document
      title={template.name}
      author={brand.name}
      subject={`${itemNoun} report — ${projectName}`}
    >
      {/* Cover page — full-bleed brand band with the logo, title and
          project, then a metadata grid below. No fixed header on the
          cover because the hero band is the visual identity. */}
      <Page
        size={size}
        orientation={orientation}
        style={[styles.page, { paddingTop: 0, paddingHorizontal: 0 }]}
      >
        <View style={styles.coverHero}>
          {logoDataUri ? (
            <Image src={logoDataUri} style={styles.coverLogo} />
          ) : null}
          <View style={styles.coverAccentBar} />
          <Text style={styles.coverTitle}>{template.name}</Text>
          <Text style={styles.coverProject}>{projectName}</Text>
        </View>

        <View style={styles.coverBody}>
          <View style={styles.coverMetaGrid}>
            <View style={styles.coverMetaCell}>
              <Text style={styles.coverMetaLabel}>Generated</Text>
              <Text style={styles.coverMetaValue}>{generatedLabel}</Text>
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
        </View>

        {PageFooter}
      </Page>

      {/* Empty-state page when filters exclude everything. */}
      {totalAfterFilter === 0 ? (
        <Page size={size} orientation={orientation} style={styles.page}>
          {PageHeader}
          <Text
            style={{
              marginTop: 30,
              fontSize: 10,
              color: brand.muted,
              textAlign: "center",
            }}
          >
            No {itemNounPlural.toLowerCase()} match the current filters.
          </Text>
          {PageFooter}
        </Page>
      ) : null}

      {/* One Page per RFI/Issue. Letting <Page wrap> handle long content
          inside a single item is robust; chaining many items inside one
          <Page wrap> with manual `break` props is the pattern that
          historically blew up @react-pdf's flex layout (out-of-range
          coords → "unsupported number" pdf-lib error). */}
      {groups.flatMap((group) =>
        group.rfis.map((rfi, ri) => {
          const link = projectId ? linkBase(projectId, rfi.id) : undefined;
          const showGroupHeading = groups.length > 1 && ri === 0;
          return (
            <Page
              key={`${group.key}-${rfi.id}`}
              size={size}
              orientation={orientation}
              style={styles.page}
              wrap
            >
              {PageHeader}

              {showGroupHeading ? (
                <Text style={styles.sectionHeading}>
                  {group.label} · {group.rfis.length}
                </Text>
              ) : null}

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
                    <Link src={link} style={styles.paragraphSmall}>
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
                    <View key={c.id} style={styles.commentBlock} wrap={false}>
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

              {PageFooter}
            </Page>
          );
        }),
      )}
    </Document>
  );
}

export async function buildDetailPdfBlob(input: DetailPdfInput): Promise<Blob> {
  const instance = pdf(<DetailPdf {...input} />);
  return instance.toBlob();
}
