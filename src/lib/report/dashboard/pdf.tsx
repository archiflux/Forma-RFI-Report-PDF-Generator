"use client";

import { Document, Image as PdfImage, Link, Page, Polyline, StyleSheet, Svg, Text, View, pdf, Line } from "@react-pdf/renderer";
import type { DashboardReport, ReportSection } from "./model";

const C = {
  primary: "#0e2841",
  secondary: "#143644",
  accent: "#d1c800",
  ink: "#111827",
  muted: "#6b7280",
  border: "#e3e6eb",
  bar: "#2a78d6",
  critical: "#d03b3b",
};

const s = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 40, paddingHorizontal: 32, fontSize: 8, fontFamily: "Helvetica", color: C.ink },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  logo: { width: 120, height: 34, objectFit: "contain" },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", color: C.primary },
  subtitle: { fontSize: 9, color: C.muted, marginTop: 2 },
  accent: { height: 3, width: 60, backgroundColor: C.accent, marginVertical: 8 },
  filters: { fontSize: 7.5, color: C.muted, marginBottom: 10 },
  kpiRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 10 },
  kpi: { width: "16.66%", paddingRight: 6, marginBottom: 6 },
  kpiBox: { borderWidth: 1, borderColor: C.border, borderRadius: 4, padding: 6 },
  kpiLabel: { fontSize: 6.5, color: C.muted, textTransform: "uppercase" },
  kpiValue: { fontSize: 15, fontFamily: "Helvetica-Bold", color: C.primary, marginTop: 2 },
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -5 },
  half: { width: "50%", paddingHorizontal: 5, marginBottom: 10 },
  full: { width: "100%", paddingHorizontal: 5, marginBottom: 10 },
  panel: { borderWidth: 1, borderColor: C.border, borderRadius: 4, padding: 8 },
  panelTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.primary, marginBottom: 6 },
  barRow: { flexDirection: "row", alignItems: "center", marginBottom: 3 },
  barLabel: { width: "34%", fontSize: 7, paddingRight: 4 },
  barTrack: { width: "54%", height: 6 },
  barValue: { width: "12%", fontSize: 7, textAlign: "right", fontFamily: "Helvetica-Bold" },
  th: { flexDirection: "row", borderBottomWidth: 1, borderColor: C.border, paddingBottom: 3, marginBottom: 2 },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: C.border, paddingVertical: 2 },
  cellHead: { flex: 1, fontSize: 6.5, color: C.muted, paddingRight: 4 },
  cell: { flex: 1, fontSize: 6.5, paddingRight: 4 },
  link: { color: C.primary, textDecoration: "none" },
  note: { fontSize: 6.5, color: C.muted, marginTop: 4 },
  footer: { position: "absolute", bottom: 18, left: 32, right: 32, flexDirection: "row", justifyContent: "space-between", fontSize: 6.5, color: C.muted },
});

function Bars({ section }: { section: Extract<ReportSection, { kind: "bars" }> }) {
  const max = Math.max(1, ...section.data.map((d) => d.count));
  if (!section.data.length) return <Text style={s.note}>No data.</Text>;
  return (
    <View>
      {section.data.map((d) => (
        <View key={d.label} style={s.barRow} wrap={false}>
          <Text style={s.barLabel}>{d.label}</Text>
          <View style={s.barTrack}>
            <View style={{ width: `${Math.max(1, (d.count / max) * 100)}%`, height: 6, backgroundColor: C.bar, borderTopRightRadius: 2, borderBottomRightRadius: 2 }} />
          </View>
          <Text style={s.barValue}>{d.count}</Text>
        </View>
      ))}
    </View>
  );
}

function Trend({ section }: { section: Extract<ReportSection, { kind: "trend" }> }) {
  const W = 360;
  const H = 120;
  const n = section.data.length;
  if (n < 2) return <Text style={s.note}>Not enough history for a trend.</Text>;
  const val = (d: Record<string, unknown>, k: string) => Number(d[k] ?? 0);
  const max = Math.max(1, ...section.data.flatMap((d) => section.series.map((x) => val(d, x.key))));
  const x = (i: number) => 4 + (i / (n - 1)) * (W - 8);
  const y = (v: number) => H - 4 - (v / max) * (H - 8);
  const first = section.data[0]?.month ?? "";
  const last = section.data[n - 1]?.month ?? "";
  return (
    <View>
      <View style={{ flexDirection: "row", marginBottom: 4 }}>
        {section.series.map((ser) => (
          <View key={ser.key} style={{ flexDirection: "row", alignItems: "center", marginRight: 10 }}>
            <View style={{ width: 10, height: 2, backgroundColor: ser.colour, marginRight: 3 }} />
            <Text style={{ fontSize: 7 }}>
              {ser.label} (latest {val(section.data[n - 1] as Record<string, unknown>, ser.key)})
            </Text>
          </View>
        ))}
        <Text style={{ fontSize: 7, color: C.muted }}>Peak {max}</Text>
      </View>
      <Svg width={W} height={H}>
        <Line x1={0} y1={H - 4} x2={W} y2={H - 4} stroke={C.border} strokeWidth={1} />
        {section.series.map((ser) => (
          <Polyline
            key={ser.key}
            points={section.data.map((d, i) => `${x(i)},${y(val(d, ser.key))}`).join(" ")}
            stroke={ser.colour}
            strokeWidth={1.5}
            fill="none"
          />
        ))}
      </Svg>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={s.note}>{first}</Text>
        <Text style={s.note}>{last}</Text>
      </View>
    </View>
  );
}

function Table({ section }: { section: Extract<ReportSection, { kind: "table" }> }) {
  return (
    <View>
      <View style={s.th} fixed>
        {section.columns.map((c, j) => (
          <Text key={c} style={[s.cellHead, { flex: section.widths?.[j] ?? 1 }]}>{c}</Text>
        ))}
      </View>
      {section.rows.map((r, i) => {
        const href = section.links?.[i];
        return (
          <View key={i} style={s.tr} wrap={false}>
            {r.map((cell, j) =>
              j === 0 && href ? (
                <Link key={j} src={href} style={[s.cell, s.link, { flex: section.widths?.[j] ?? 1 }]}>{cell}</Link>
              ) : (
                <Text key={j} style={[s.cell, { flex: section.widths?.[j] ?? 1 }]}>{cell}</Text>
              ),
            )}
          </View>
        );
      })}
      {section.totalRows && section.totalRows > section.rows.length ? (
        <Text style={s.note}>
          Showing the first {section.rows.length} of {section.totalRows} rows. Narrow the filters to include the rest.
        </Text>
      ) : null}
    </View>
  );
}

export function DashboardPdf({ report, logoDataUri }: { report: DashboardReport; logoDataUri?: string }) {
  const generated = new Date(report.generatedAt).toLocaleString("en-GB");
  const charts = report.sections.filter((x) => x.kind !== "table");
  const tables = report.sections.filter((x) => x.kind === "table");
  return (
    <Document title={report.title} author="Bailey Partnership">
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.header}>
          <View>
            <Text style={s.title}>{report.title}</Text>
            <Text style={s.subtitle}>{report.subtitle}</Text>
          </View>
          {logoDataUri ? <PdfImage src={logoDataUri} style={s.logo} /> : null}
        </View>
        <View style={s.accent} />
        <Text style={s.filters}>{report.filters.join("  |  ")}</Text>
        <View style={s.kpiRow}>
          {report.kpis.map((k) => (
            <View key={k.label} style={s.kpi}>
              <View style={s.kpiBox}>
                <Text style={s.kpiLabel}>{k.label}</Text>
                <Text style={[s.kpiValue, k.alert ? { color: C.critical } : {}]}>{k.value}</Text>
              </View>
            </View>
          ))}
        </View>
        <View style={s.grid}>
          {charts.map((sec) => (
            <View key={sec.title} style={s.half} wrap={false}>
              <View style={s.panel}>
                <Text style={s.panelTitle}>{sec.title}</Text>
                {sec.kind === "bars" ? <Bars section={sec} /> : sec.kind === "trend" ? <Trend section={sec} /> : null}
              </View>
            </View>
          ))}
        </View>
        {tables.map((sec) =>
          sec.kind === "table" ? (
            <View key={sec.title} style={s.full} break>
              <Text style={s.panelTitle}>{sec.title}</Text>
              <Table section={sec} />
            </View>
          ) : null,
        )}
        <View style={s.footer} fixed>
          <Text>Bailey Partnership - {report.title} - generated {generated}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function buildDashboardPdf(report: DashboardReport, logoDataUri?: string): Promise<Blob> {
  return pdf(<DashboardPdf report={report} logoDataUri={logoDataUri} />).toBlob();
}
