import { describe, expect, it } from "vitest";
import type { CustomAttributeDef, Rfi } from "@/lib/aps/types";
import { applyFilter, applyGroupBy, applySort, applyTemplate } from "@/lib/report/apply";
import { customField, type ReportTemplate } from "@/lib/report/types";

const ATTRS: CustomAttributeDef[] = [
  {
    id: "discipline",
    name: "Discipline",
    dataType: "singleChoice",
    values: [
      { id: "arch", label: "Architecture" },
      { id: "struct", label: "Structural" },
      { id: "mep", label: "MEP" },
    ],
  },
  {
    id: "cost",
    name: "Estimated cost",
    dataType: "numeric",
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

// Wrap scalar/array test values into the on-the-wire normalised shape:
// `customAttributes` is always Record<attrId, unknown[]>. Each scalar becomes
// a 1-element array; arrays pass through; null/undefined drop the key.
function asValuesRecord(custom: Record<string, unknown> | undefined): Record<string, unknown[]> {
  const out: Record<string, unknown[]> = {};
  if (!custom) return out;
  for (const [k, v] of Object.entries(custom)) {
    if (v === null || v === undefined) continue;
    out[k] = Array.isArray(v) ? v : [v];
  }
  return out;
}

function rfi(
  i: number,
  overrides: Partial<Rfi> & { custom?: Record<string, unknown> } = {},
): Rfi {
  const { custom, ...rest } = overrides;
  return {
    id: `rfi-${i}`,
    number: `RFI-${String(i).padStart(4, "0")}`,
    title: `Title ${i}`,
    status: "open",
    statusLabel: "Open",
    createdAt: `2026-0${(i % 9) + 1}-0${(i % 9) + 1}T00:00:00Z`,
    dueDate: `2026-0${(i % 9) + 1}-15`,
    customAttributes: asValuesRecord(custom),
    attachmentCount: 0,
    assignees: [{ id: `u${i}`, name: `User ${i}` }], attachments: [],
    ...rest,
  };
}

const SET: Rfi[] = [
  rfi(1, {
    title: "Foundation query",
    status: "open",
    statusLabel: "Open",
    assignees: [{ id: "u1", name: "Alice Archer" }], attachments: [],
    dueDate: "2026-05-01",
    question: "Rebar spacing?",
    custom: { discipline: "struct", cost: 5000, tags: ["urgent"] },
  }),
  rfi(2, {
    title: "Lighting design",
    status: "closed",
    statusLabel: "Closed",
    assignees: [{ id: "u2", name: "Bob Builder" }], attachments: [],
    dueDate: "2026-06-10",
    question: "LED spec?",
    custom: { discipline: "mep", cost: 2500, tags: ["external", "urgent"] },
  }),
  rfi(3, {
    title: "Facade cladding",
    status: "open",
    statusLabel: "Open",
    assignees: [{ id: "u3", name: "Alice Archer" }], attachments: [],
    dueDate: "2026-04-20",
    question: "Panel joint detail?",
    custom: { discipline: "arch", cost: 8000, tags: [] },
  }),
  rfi(4, {
    title: "Slab edge",
    status: "open",
    statusLabel: "Open",
    dueDate: undefined,
    custom: { discipline: "struct", cost: undefined },
  }),
];

describe("applyFilter", () => {
  it("returns everything when filter is empty", () => {
    expect(applyFilter(SET, {}, ATTRS)).toHaveLength(SET.length);
  });

  it("free-text search matches title, number, question", () => {
    expect(applyFilter(SET, { search: "rebar" }, ATTRS).map((r) => r.id)).toEqual(["rfi-1"]);
    expect(applyFilter(SET, { search: "slab" }, ATTRS).map((r) => r.id)).toEqual(["rfi-4"]);
  });

  it("status filter matches raw id OR resolved label", () => {
    expect(applyFilter(SET, { status: ["closed"] }, ATTRS).map((r) => r.id)).toEqual(["rfi-2"]);
    expect(applyFilter(SET, { status: ["Open"] }, ATTRS).map((r) => r.id).sort()).toEqual([
      "rfi-1",
      "rfi-3",
      "rfi-4",
    ]);
  });

  it("assignee 'contains' is case-insensitive", () => {
    expect(applyFilter(SET, { assigneeContains: "ALICE" }, ATTRS).map((r) => r.id).sort()).toEqual([
      "rfi-1",
      "rfi-3",
    ]);
  });

  it("dueDate range is inclusive at both ends", () => {
    const out = applyFilter(SET, { dueDate: { gte: "2026-05-01", lte: "2026-06-10" } }, ATTRS);
    expect(out.map((r) => r.id).sort()).toEqual(["rfi-1", "rfi-2"]);
  });

  it("custom single-choice 'values' filter selects matching id only", () => {
    const out = applyFilter(
      SET,
      { customAttributes: { discipline: { values: ["struct"] } } },
      ATTRS,
    );
    expect(out.map((r) => r.id).sort()).toEqual(["rfi-1", "rfi-4"]);
  });

  it("custom multi-choice 'values' filter uses any-of semantics", () => {
    const out = applyFilter(
      SET,
      { customAttributes: { tags: { values: ["external"] } } },
      ATTRS,
    );
    expect(out.map((r) => r.id)).toEqual(["rfi-2"]);
  });

  it("custom numeric range filter respects gte/lte", () => {
    const out = applyFilter(
      SET,
      { customAttributes: { cost: { range: { gte: 3000, lte: 6000 } } } },
      ATTRS,
    );
    expect(out.map((r) => r.id)).toEqual(["rfi-1"]);
  });

  it("combined filters AND together", () => {
    const out = applyFilter(
      SET,
      {
        status: ["open"],
        customAttributes: { discipline: { values: ["struct"] } },
      },
      ATTRS,
    );
    expect(out.map((r) => r.id).sort()).toEqual(["rfi-1", "rfi-4"]);
  });

  it("unknown custom-attribute ids are silently skipped (template portability)", () => {
    const out = applyFilter(
      SET,
      { customAttributes: { not_in_project: { contains: "whatever" } } },
      ATTRS,
    );
    expect(out).toHaveLength(SET.length);
  });
});

describe("applySort", () => {
  it("sorts ascending by built-in field with nulls last", () => {
    const out = applySort(SET, [{ field: "dueDate", order: "asc" }], ATTRS);
    expect(out.map((r) => r.id)).toEqual(["rfi-3", "rfi-1", "rfi-2", "rfi-4"]);
  });

  it("sorts descending", () => {
    const out = applySort(SET, [{ field: "dueDate", order: "desc" }], ATTRS);
    expect(out.at(0)?.id).toBe("rfi-2");
  });

  it("supports custom numeric attribute sort", () => {
    const out = applySort(SET, [{ field: customField("cost"), order: "asc" }], ATTRS);
    expect(out.map((r) => r.id)).toEqual(["rfi-2", "rfi-1", "rfi-3", "rfi-4"]);
  });

  it("multi-field sort uses second field as tie-breaker", () => {
    const out = applySort(
      SET,
      [
        { field: "statusLabel", order: "asc" },
        { field: "number", order: "desc" },
      ],
      ATTRS,
    );
    // Closed < Open alphabetically, so rfi-2 comes first; within Open, number desc.
    expect(out.map((r) => r.id)).toEqual(["rfi-2", "rfi-4", "rfi-3", "rfi-1"]);
  });
});

describe("applyGroupBy", () => {
  it("returns a single 'All RFIs' group when groupBy is undefined", () => {
    const groups = applyGroupBy(SET, undefined, ATTRS);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.rfis).toHaveLength(SET.length);
  });

  it("groups by resolved custom-attribute display", () => {
    const groups = applyGroupBy(SET, customField("discipline"), ATTRS);
    const byLabel = Object.fromEntries(groups.map((g) => [g.label, g.rfis.length]));
    expect(byLabel).toEqual({
      "Discipline: Architecture": 1,
      "Discipline: MEP": 1,
      "Discipline: Structural": 2,
    });
  });
});

describe("applyTemplate", () => {
  it("composes filter → sort → group and exposes totalBeforeFilter", () => {
    const template: ReportTemplate = {
      id: "t1",
      name: "Open Structural by due date",
      createdInProjectId: "p1",
      fields: ["number", "title", "dueDate", customField("discipline")],
      filter: {
        status: ["open"],
        customAttributes: { discipline: { values: ["struct"] } },
      },
      sort: [{ field: "dueDate", order: "asc" }],
      groupBy: customField("discipline"),
      output: "pdf",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    };
    const { filtered, groups, totalBeforeFilter } = applyTemplate(SET, template, ATTRS);
    expect(totalBeforeFilter).toBe(SET.length);
    expect(filtered.map((r) => r.id)).toEqual(["rfi-1", "rfi-4"]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.label).toBe("Discipline: Structural");
  });
});
