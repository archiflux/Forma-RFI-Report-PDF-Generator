import { describe, expect, it } from "vitest";
import type { CustomAttributeDef, Rfi } from "@/lib/aps/types";
import { applyTemplate } from "@/lib/report/apply";
import { buildCsv } from "@/lib/report/export/csv";
import { customField, emptyTemplate, type ReportTemplate } from "@/lib/report/types";

const ATTRS: CustomAttributeDef[] = [
  {
    id: "disc",
    name: "Discipline",
    dataType: "singleChoice",
    values: [
      { id: "arch", label: "Architecture" },
      { id: "struct", label: "Structural" },
    ],
  },
  {
    id: "tags",
    name: "Tags",
    dataType: "multiChoice",
    values: [
      { id: "urgent", label: "Urgent" },
      { id: "external", label: "External" },
    ],
  },
];

function rfi(overrides: Partial<Rfi> & { custom?: Record<string, unknown> } = {}): Rfi {
  const { custom, ...rest } = overrides;
  return {
    id: "r1",
    number: "RFI-0001",
    title: "Normal",
    status: "open",
    statusLabel: "Open",
    createdAt: "2026-01-15T00:00:00Z",
    dueDate: "2026-02-01",
    customAttributes: custom ?? {},
    attachmentCount: 0,
    assignee: { id: "u", name: "Alice" },
    ...rest,
  };
}

function baseTemplate(): ReportTemplate {
  const t = emptyTemplate("p");
  t.fields = ["number", "title", "statusLabel", "dueDate", customField("disc"), customField("tags")];
  return t;
}

function runExport(rfis: Rfi[], template: ReportTemplate = baseTemplate()): string {
  const { groups } = applyTemplate(rfis, template, ATTRS);
  return buildCsv({ template, groups, customAttributes: ATTRS });
}

describe("buildCsv", () => {
  it("begins with a UTF-8 BOM so Excel opens it correctly", () => {
    const csv = runExport([rfi()]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it("uses CRLF line terminators", () => {
    const csv = runExport([rfi()]);
    const body = csv.slice(1); // strip BOM
    expect(body).toContain("\r\n");
    // No bare \n outside of a \r\n
    const bareLf = body.match(/(?<!\r)\n/);
    expect(bareLf).toBeNull();
  });

  it("emits header row with custom-attribute labels disambiguated", () => {
    const csv = runExport([rfi()]);
    const header = csv.slice(1).split("\r\n")[0];
    expect(header).toContain("RFI #");
    expect(header).toContain("Discipline (custom)");
    expect(header).toContain("Tags (custom)");
  });

  it("quotes values containing commas, quotes, and newlines", () => {
    const csv = runExport([
      rfi({
        title: `Has, comma and "quotes"`,
        custom: { disc: "arch" },
      }),
      rfi({ id: "r2", number: "RFI-0002", title: "Line\nbreak" }),
    ]);
    // Quote escape: " → ""
    expect(csv).toContain(`"Has, comma and ""quotes"""`);
    // Newline survives inside quotes
    expect(csv).toMatch(/"Line\nbreak"/);
  });

  it("joins multi-choice values with ' | '", () => {
    const csv = runExport([
      rfi({ custom: { tags: ["urgent", "external"] } }),
    ]);
    expect(csv).toContain("Urgent | External");
  });

  it("resolves single-choice ids to labels", () => {
    const csv = runExport([rfi({ custom: { disc: "struct" } })]);
    expect(csv).toContain("Structural");
    expect(csv).not.toMatch(/,struct(,|$)/);
  });

  it("preserves the user-selected column order", () => {
    const t = baseTemplate();
    t.fields = ["title", "number"]; // reversed from default
    const csv = runExport([rfi({ title: "ABC", number: "RFI-0001" })], t);
    const [header, firstRow] = csv.slice(1).split("\r\n");
    expect(header).toBe(`"Title","RFI #"`);
    expect(firstRow).toBe(`"ABC","RFI-0001"`);
  });

  it("prepends a Group column when groupBy is set", () => {
    const t = baseTemplate();
    t.groupBy = customField("disc");
    t.fields = ["number", "title"];
    const csv = runExport(
      [
        rfi({ id: "a", number: "A", title: "a", custom: { disc: "arch" } }),
        rfi({ id: "b", number: "B", title: "b", custom: { disc: "struct" } }),
      ],
      t,
    );
    const lines = csv.slice(1).split("\r\n");
    expect(lines[0]).toBe(`"Group","RFI #","Title"`);
    expect(lines[1]).toMatch(/^"Discipline: Architecture","A","a"$/);
    expect(lines[2]).toMatch(/^"Discipline: Structural","B","b"$/);
  });

  it("handles unicode cleanly (£, ö, emdash)", () => {
    const csv = runExport([rfi({ title: "£5,000 — föo" })]);
    expect(csv).toContain("£5,000 — föo");
  });

  it("emits an empty body (just header) when no RFIs match", () => {
    const csv = runExport([]);
    const lines = csv.slice(1).split("\r\n").filter(Boolean);
    expect(lines).toHaveLength(1); // header only
  });
});
