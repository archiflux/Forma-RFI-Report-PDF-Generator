import { describe, expect, it } from "vitest";
import { applyLayoutToReport, sanitiseLayout, toggleHidden } from "./layout";
import { registerSection, sortItems, visibleColumns, type RegisterColumn } from "./register";
import { buildIssuesReport } from "@/lib/dashboard/report";
import { demoDataset } from "@/lib/dashboard/demo";
import { EMPTY_FILTERS } from "@/lib/dashboard/types";
import { deleteSet, loadSets, saveSet, updateSetLayout } from "@/lib/dashboard/project-sets";
import type { DashboardReport } from "@/lib/report/dashboard/model";

type Row = { n: string; d?: string; c: number };
const COLS: Array<RegisterColumn<Row>> = [
  { id: "n", label: "Name", value: (r) => r.n, default: true },
  { id: "d", label: "Date", value: (r) => r.d ?? "", default: true },
  { id: "c", label: "Count", value: (r) => String(r.c), sortValue: (r) => r.c, href: () => "https://x" },
];

function memStore(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, v),
  };
}

describe("dashboard layout", () => {
  it("toggles hidden panels", () => {
    const a = toggleHidden({ hidden: [] }, "trend");
    expect(a.hidden).toEqual(["trend"]);
    expect(toggleHidden(a, "trend").hidden).toEqual([]);
  });

  it("accepts only a well-formed layout", () => {
    expect(sanitiseLayout(null)).toBeUndefined();
    expect(sanitiseLayout({ hidden: ["a", 3], columns: ["x"], sort: { col: "x", dir: 1 } })).toEqual({ hidden: ["a"], columns: ["x"], sort: { col: "x", dir: 1 } });
    expect(sanitiseLayout({ hidden: [], sort: { col: "x", dir: 2 } })).toEqual({ hidden: [] });
  });

  it("drops hidden panels and key figures from a report", () => {
    const report: DashboardReport = {
      title: "t",
      subtitle: "",
      generatedAt: "",
      filters: [],
      kpis: [{ label: "A", value: "1" }],
      sections: [
        { kind: "bars", id: "type", title: "Type", data: [] },
        { kind: "bars", id: "cause", title: "Cause", data: [] },
        { kind: "bars", title: "No id", data: [] },
      ],
    };
    const out = applyLayoutToReport(report, { hidden: ["type", "kpis"] });
    expect(out.kpis).toEqual([]);
    expect(out.sections.map((s) => s.title)).toEqual(["Cause", "No id"]);
  });
});

describe("register columns", () => {
  const rows: Row[] = [
    { n: "b", d: "2026-02-01", c: 10 },
    { n: "a", c: 9 },
    { n: "c", d: "2026-01-01", c: 100 },
  ];

  it("shows defaults until the user picks columns, then their order", () => {
    expect(visibleColumns(COLS, { hidden: [] }).map((c) => c.id)).toEqual(["n", "d"]);
    expect(visibleColumns(COLS, { hidden: [], columns: ["c", "n", "gone"] }).map((c) => c.id)).toEqual(["c", "n"]);
  });

  it("sorts numbers numerically and keeps blanks last both ways", () => {
    expect(sortItems(rows, COLS, { col: "c", dir: 1 }).map((r) => r.c)).toEqual([9, 10, 100]);
    expect(sortItems(rows, COLS, { col: "d", dir: 1 }).map((r) => r.n)).toEqual(["c", "b", "a"]);
    expect(sortItems(rows, COLS, { col: "d", dir: -1 }).map((r) => r.n)).toEqual(["b", "c", "a"]);
  });

  it("builds the PDF register with the chosen columns and sort, linked column first", () => {
    const s = registerSection({ title: "R", all: COLS, items: rows, layout: { hidden: [], columns: ["n", "c"], sort: { col: "n", dir: -1 } }, defaultSort: { col: "n", dir: 1 } });
    if (s.kind !== "table") throw new Error("kind");
    expect(s.columns).toEqual(["Count", "Name"]);
    expect(s.rows.map((r) => r[1])).toEqual(["c", "b", "a"]);
    expect(s.links?.[0]).toBe("https://x");
  });

  it("puts the issue register's chosen columns into the PDF and omits hidden panels", () => {
    const ds = demoDataset();
    const now = new Date("2026-10-22T09:00:00Z");
    const layout = { hidden: ["trend"], columns: ["number", "status"], sort: { col: "number", dir: 1 as const } };
    const report = applyLayoutToReport(
      buildIssuesReport({ issues: ds.issues, filters: EMPTY_FILTERS, projectNames: {}, projectCount: 1, now, includeRegister: true, layout }),
      layout,
    );
    expect(report.sections.some((s) => s.id === "trend")).toBe(false);
    const reg = report.sections.find((s) => s.id === "register");
    if (reg?.kind !== "table") throw new Error("no register");
    expect(reg.columns).toEqual(["#", "Status"]);
    const nums = reg.rows.map((r) => Number(r[0]));
    expect(nums).toEqual([...nums].sort((a, b) => a - b));
  });
});

describe("project sets remember layouts", () => {
  it("saves, merges and updates layouts per dashboard", () => {
    const store = memStore();
    saveSet("u", { name: "North", hubId: "h", projects: [{ id: "p", name: "P" }], layouts: { issues: { hidden: ["map"] } } }, store);
    saveSet("u", { name: "north", hubId: "h", projects: [{ id: "p", name: "P" }], layouts: { forms: { hidden: ["kpis"] } } }, store);
    let [set] = loadSets("u", store);
    expect(set?.layouts).toEqual({ issues: { hidden: ["map"] }, forms: { hidden: ["kpis"] } });
    updateSetLayout("u", set?.id ?? "", "issues", { hidden: [], columns: ["title"] }, store);
    [set] = loadSets("u", store);
    expect(set?.layouts?.issues).toEqual({ hidden: [], columns: ["title"] });
    deleteSet("u", set?.id ?? "", store);
    expect(loadSets("u", store)).toEqual([]);
  });
});
