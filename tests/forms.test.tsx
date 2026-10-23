import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { formStatusLabel, isFormOpen, isFormOverdue, normaliseForm } from "@/lib/forms/normalise";
import { countBy, monthlyCounts } from "@/lib/dashboard/aggregate";
import { FormsView } from "@/components/forms/forms-view";
import type { FormRecord } from "@/lib/forms/types";

const NOW = new Date("2026-10-23T12:00:00Z");
const ctx = {
  projectId: "p1",
  projectName: "Project One",
  templates: { t1: "Daily Site Report" },
  people: new Map([["AUTODESK1", "Sam Jones"]]),
};

describe("normaliseForm", () => {
  it("resolves template and creator names", () => {
    const f = normaliseForm(
      {
        id: "f1",
        formNum: 7,
        name: "Daily report 23 Oct",
        status: "draft",
        formDate: "2026-10-23",
        dueDate: "2026-10-20",
        createdBy: "AUTODESK1",
        createdAt: "2026-10-23T08:00:00Z",
        formTemplate: { id: "t1", name: "Old name", templateType: "pg-dailylog" },
      },
      ctx,
    );
    expect(f).toMatchObject({
      key: "p1:f1",
      formNum: "7",
      templateName: "Daily Site Report",
      templateType: "pg-dailylog",
      createdBy: "Sam Jones",
    });
    expect(isFormOpen(f as FormRecord)).toBe(true);
    expect(isFormOverdue(f as FormRecord, NOW)).toBe(true);
  });

  it("falls back to the template name on the form, then a placeholder", () => {
    expect(normaliseForm({ id: "a", formTemplate: { id: "t9", name: "Permit" } }, ctx)?.templateName).toBe("Permit");
    expect(normaliseForm({ id: "b" }, ctx)?.templateName).toBe("Unknown template");
    expect(normaliseForm({ id: "c", createdBy: "ZZZZZZZZ" }, ctx)?.createdBy).toBe("Unknown user (ZZZZZZ)");
    expect(normaliseForm({ name: "no id" }, ctx)).toBeNull();
  });

  it("treats submitted and closed forms as done", () => {
    const base = normaliseForm({ id: "x", dueDate: "2026-01-01" }, ctx) as FormRecord;
    expect(isFormOverdue({ ...base, status: "submitted" }, NOW)).toBe(false);
    expect(isFormOpen({ ...base, status: "Closed" })).toBe(false);
  });

  it("labels camelCase and snake_case statuses", () => {
    expect(formStatusLabel("inReview")).toBe("In review");
    expect(formStatusLabel("in_review")).toBe("In review");
  });
});

describe("generic aggregation helpers", () => {
  it("countBy works on any record type", () => {
    expect(countBy([{ t: "a" }, { t: "a" }, { t: "b" }], (x) => x.t)).toEqual([
      { label: "a", count: 2 },
      { label: "b", count: 1 },
    ]);
  });

  it("monthlyCounts gap-fills months", () => {
    expect(monthlyCounts([{ d: "2026-01-05" }, { d: "2026-03-01" }, { d: undefined }], (x) => x.d)).toEqual([
      { month: "2026-01", count: 1 },
      { month: "2026-02", count: 0 },
      { month: "2026-03", count: 1 },
    ]);
  });
});

describe("FormsView", () => {
  it("renders KPIs and the register from a dataset", () => {
    const forms = ["draft", "submitted", "draft"].map(
      (status, i) =>
        normaliseForm(
          { id: `f${i}`, formNum: i + 1, name: `Form ${i + 1}`, status, formDate: `2026-0${i + 7}-01`, dueDate: "2026-10-01", formTemplate: { id: "t1" } },
          ctx,
        ) as FormRecord,
    );
    const html = renderToString(
      <FormsView dataset={{ projects: [{ id: "p1", name: "Project One", formCount: 3 }], forms }} now={NOW} />,
    );
    expect(html).toContain("Form register (3)");
    expect(html).toContain("Daily Site Report");
    expect(html).toContain("(overdue)");
  });
});
