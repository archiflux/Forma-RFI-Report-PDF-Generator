import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { customFieldIndex, customValues, matchesCustom } from "@/lib/custom/filter";
import { applyFilters } from "@/lib/dashboard/aggregate";
import { EMPTY_FILTERS, type IssueRecord } from "@/lib/dashboard/types";
import { normalizeRfi } from "@/lib/aps/rfis";
import { rfiCustom, rfisConfig, toRfiRecord } from "@/lib/rfis-dash/config";
import { applyGenericFilters } from "@/lib/generic/aggregate";
import { EMPTY_GENERIC_FILTERS } from "@/lib/generic/types";
import { parseGenericDataset } from "@/lib/generic/snapshot";
import { GenericView } from "@/components/generic/generic-view";

describe("custom field filter", () => {
  it("splits multi-select values and treats missing as Not set", () => {
    expect(customValues("A | B")).toEqual(["A", "B"]);
    expect(customValues(undefined)).toEqual(["Not set"]);
    expect(matchesCustom({ Package: "M&E | Civils" }, { Package: ["Civils"] })).toBe(true);
    expect(matchesCustom({ Package: "M&E" }, { Package: ["Civils"] })).toBe(false);
    expect(matchesCustom({}, { Package: ["Not set"] })).toBe(true);
    expect(matchesCustom({}, { Package: [] })).toBe(true);
  });

  it("indexes fields by how many records use them", () => {
    expect(customFieldIndex([{ A: "x" }, { A: "y", B: "z" }, undefined])).toEqual([
      { field: "A", count: 2, values: ["x", "y", "Not set"] },
      { field: "B", count: 1, values: ["z", "Not set"] },
    ]);
  });

  it("filters issues by custom field", () => {
    const base = { projectId: "p", projectName: "P", displayId: "1", title: "t", status: "open", typeName: "T", subtypeName: "T", rootCause: "-", createdAt: "2026-01-01", commentCount: 0, attachmentCount: 0, hasViewpoint: false };
    const issues = [
      { ...base, key: "1", id: "1", custom: { Discipline: "MEP" } },
      { ...base, key: "2", id: "2", custom: {} },
    ] as IssueRecord[];
    expect(applyFilters(issues, { ...EMPTY_FILTERS, custom: { Discipline: ["MEP"] } }).map((i) => i.id)).toEqual(["1"]);
    expect(applyFilters(issues, { ...EMPTY_FILTERS, custom: { Discipline: ["Not set"] } }).map((i) => i.id)).toEqual(["2"]);
  });
});

describe("RFI custom attributes", () => {
  const defs = [
    { id: "a1", name: "Package", dataType: "singleChoice" as const, values: [{ id: "o1", label: "Facade" }] },
    { id: "a2", name: "a2", dataType: "text" as const, inferred: true },
  ];
  const raw = { id: "r", title: "t", createdAt: "2026-01-01", customAttributes: [{ id: "a1", values: ["o1"] }, { id: "a2", values: ["x"] }] };

  it("resolves titles and choice labels, skipping id-only fields", () => {
    expect(rfiCustom(normalizeRfi(raw), defs)).toEqual({ Package: "Facade" });
  });

  it("filters and survives a redacted snapshot round trip", () => {
    const rec = toRfiRecord(normalizeRfi(raw), "p", "P", new Map(), defs);
    expect(applyGenericFilters([rec], rfisConfig, { ...EMPTY_GENERIC_FILTERS, custom: { Package: ["Facade"] } })).toHaveLength(1);
    expect(applyGenericFilters([rec], rfisConfig, { ...EMPTY_GENERIC_FILTERS, custom: { Package: ["Roof"] } })).toHaveLength(0);
    const ds = { projects: [{ id: "p", name: "P", count: 1 }], items: [rec] };
    expect(parseGenericDataset(JSON.parse(JSON.stringify(ds))).items[0]).toMatchObject({ custom: { Package: "Facade" } });
    expect(rfisConfig.redact(ds).items[0]?.custom).toEqual({});
    const html = renderToString(<GenericView cfg={rfisConfig} dataset={ds} now={new Date("2026-10-23")} />);
    expect(html).toContain("+ Custom field filter");
  });
});
