import { describe, expect, it } from "vitest";
import { applyGenericFilters, dimValues } from "@/lib/generic/aggregate";
import { EMPTY_GENERIC_FILTERS } from "@/lib/generic/types";
import { rfisConfig, type RfiRecord } from "@/lib/rfis-dash/config";
import { applyFormFilters, EMPTY_FORM_FILTERS } from "@/lib/forms/aggregate";
import { formCustom } from "@/lib/forms/normalise";
import { redactForms } from "@/lib/forms/snapshot";
import type { FormRecord } from "@/lib/forms/types";
import { inDateRange } from "@/lib/dashboard/date-range";

const rfi = (id: string, over: Partial<RfiRecord>): RfiRecord => ({
  key: id, id, projectId: "p", projectName: "P", number: id, title: "t", status: "open", createdAt: "2026-05-10T00:00:00Z", custom: {}, ...over,
});

describe("generic filters", () => {
  const items = [rfi("a", { ballInCourt: "Pat, Sam" }), rfi("b", { ballInCourt: "Sam", createdAt: "2026-09-01T00:00:00Z" }), rfi("c", {})];
  const bic = rfisConfig.filters.find((d) => d.id === "bic")!;

  it("splits multi-person values into separate options", () => {
    expect(dimValues(bic, items[0]!)).toEqual(["Pat", "Sam"]);
    expect(applyGenericFilters(items, rfisConfig, { ...EMPTY_GENERIC_FILTERS, dims: { bic: ["Sam"] } }).map((r) => r.id)).toEqual(["a", "b"]);
    expect(applyGenericFilters(items, rfisConfig, { ...EMPTY_GENERIC_FILTERS, dims: { bic: ["Not recorded"] } }).map((r) => r.id)).toEqual(["c"]);
  });

  it("filters by date range", () => {
    expect(applyGenericFilters(items, rfisConfig, { ...EMPTY_GENERIC_FILTERS, from: "2026-08-01" }).map((r) => r.id)).toEqual(["b"]);
    expect(inDateRange(undefined, "2026-01-01")).toBe(false);
    expect(inDateRange(undefined)).toBe(true);
  });
});

describe("forms filters", () => {
  it("reads answers from customValues and filters on them, by creator and by date", () => {
    expect(formCustom([{ itemLabel: "Weather", choiceVal: "Rain" }, { itemLabel: "Crew", numberVal: 6 }, { noLabel: 1 }, { itemLabel: "Areas", arrayVal: ["L1", "L2"] }])).toEqual({
      Weather: "Rain",
      Crew: "6",
      Areas: "L1 | L2",
    });
    const base = { projectId: "p", projectName: "P", formNum: "1", name: "n", status: "draft", templateId: "t", templateName: "T", createdAt: "2026-01-01" };
    const forms: FormRecord[] = [
      { ...base, key: "1", id: "1", createdBy: "Pat", formDate: "2026-03-01", custom: { Weather: "Rain" } },
      { ...base, key: "2", id: "2", formDate: "2026-06-01", custom: { Weather: "Sun" } },
    ];
    expect(applyFormFilters(forms, { ...EMPTY_FORM_FILTERS, custom: { Weather: ["Rain"] } }).map((f) => f.id)).toEqual(["1"]);
    expect(applyFormFilters(forms, { ...EMPTY_FORM_FILTERS, creators: ["Unknown"] }).map((f) => f.id)).toEqual(["2"]);
    expect(applyFormFilters(forms, { ...EMPTY_FORM_FILTERS, from: "2026-05-01" }).map((f) => f.id)).toEqual(["2"]);
    expect(redactForms({ projects: [], forms }).forms[0]).toMatchObject({ custom: {}, createdBy: "Person 1" });
  });
});
