import { describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { demoDataset } from "@/lib/dashboard/demo";
import { buildIssuesReport } from "@/lib/dashboard/report";
import { buildFormsReport } from "@/lib/forms/report";
import { DashboardPdf } from "@/lib/report/dashboard/pdf";
import { EMPTY_FILTERS } from "@/lib/dashboard/types";
import { EMPTY_FORM_FILTERS } from "@/lib/forms/aggregate";
import { capRows, describeFilters } from "@/lib/report/dashboard/model";
import type { FormRecord } from "@/lib/forms/types";

const NOW = new Date("2026-10-23T12:00:00Z");

describe("dashboard report model", () => {
  it("describes filters, or says there are none", () => {
    expect(describeFilters([["Status", []], ["Search", undefined]])).toEqual(["No filters (everything loaded)"]);
    expect(describeFilters([["Status", ["Open", "Closed"]]])).toEqual(["Status: Open, Closed"]);
  });

  it("caps tables and remembers the full count", () => {
    expect(capRows([1, 2, 3], 2)).toEqual({ rows: [1, 2], totalRows: 3 });
  });

  it("builds an issues report from the filtered issues", () => {
    const ds = demoDataset(NOW);
    const r = buildIssuesReport({
      issues: ds.issues,
      filters: { ...EMPTY_FILTERS, statuses: ["open"] },
      projectNames: {},
      projectCount: 4,
      now: NOW,
      includeRegister: true,
    });
    expect(r.kpis[0]).toEqual({ label: "Issues", value: String(ds.issues.length) });
    expect(r.filters).toEqual(["Status: Open"]);
    const register = r.sections.find((x) => x.kind === "table" && x.title.startsWith("Issue register"));
    expect(register && register.kind === "table" ? register.rows.length : 0).toBe(ds.issues.length);
    // Demo projects have no Forma URL.
    expect(register && register.kind === "table" ? register.links?.[0] : "x").toBeUndefined();
    expect(buildIssuesReport({ issues: [], filters: EMPTY_FILTERS, projectNames: {}, projectCount: 0, now: NOW, includeRegister: false }).sections.some((x) => x.title.startsWith("Issue register"))).toBe(false);
  });

  it("renders a real PDF for issues and forms", async () => {
    const ds = demoDataset(NOW);
    const issues = buildIssuesReport({ issues: ds.issues, filters: EMPTY_FILTERS, projectNames: {}, projectCount: 4, now: NOW, includeRegister: true });
    const form: FormRecord = {
      key: "p:f", id: "f", projectId: "p", projectName: "P", formNum: "1", name: "Daily report",
      status: "draft", templateId: "t", templateName: "Daily", createdAt: "2026-10-01T00:00:00Z", formDate: "2026-10-01", dueDate: "2026-10-02",
    };
    const forms = buildFormsReport({ forms: [form], filters: EMPTY_FORM_FILTERS, projectNames: {}, now: NOW, includeRegister: true });
    for (const report of [issues, forms]) {
      const buf = await renderToBuffer(<DashboardPdf report={report} />);
      expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
      expect(buf.length).toBeGreaterThan(5000);
    }
  }, 60_000);
});

describe("register CSV", () => {
  it("exports every row with escaping, BOM and a Forma link column", async () => {
    const { registerCsv } = await import("@/lib/report/dashboard/model");
    const ds = demoDataset(NOW);
    ds.issues[0] = { ...ds.issues[0]!, title: 'Say "hi", then\nleave' };
    const r = buildIssuesReport({ issues: ds.issues, filters: EMPTY_FILTERS, projectNames: {}, projectCount: 4, now: NOW, includeRegister: true, maxRegisterRows: Infinity });
    const csv = registerCsv(r) as string;
    expect(csv.startsWith("﻿Title,Project,#")).toBe(true);
    expect(csv.split("\r\n")[0]).toMatch(/,Forma link$/);
    expect(csv).toContain('"Say ""hi"", then\nleave"');
    // header + one line per issue + trailing CRLF
    expect(csv.split("\r\n").length).toBe(ds.issues.length + 2);
    expect(registerCsv({ ...r, sections: [] })).toBeNull();
  });
});
