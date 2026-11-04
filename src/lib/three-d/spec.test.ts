import { describe, expect, it } from "vitest";
import {
  barsScene,
  gaugeScene,
  globeScene,
  gridScene,
  heightScale,
  isEmptyScene,
  latLonToXYZ,
  openClosedScene,
  overdueScene,
  seriesScene,
  stackedScene,
} from "./spec";

describe("3D scene builders", () => {
  it("drops zero and non-finite counts and uses one colour for bar lists", () => {
    const s = barsScene("T", "issues", [
      { label: "A", count: 3 },
      { label: "B", count: 0 },
      { label: "C", count: Number.NaN },
      { label: "Other", count: 2 },
    ]);
    expect(s.kind).toBe("bars");
    if (s.kind !== "bars") return;
    expect(s.items.map((d) => d.label)).toEqual(["A", "Other"]);
    expect(s.items[0]?.colour).toBe("var(--series-1)");
    expect(s.items[1]?.colour).toBe("var(--series-other)");
  });

  it("keeps the 25 largest rows in a grid, largest first", () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({ label: `P${i}`, values: [i, 1] }));
    const s = gridScene("T", "x", rows, [
      { label: "a", colour: "red" },
      { label: "b", colour: "blue" },
    ]);
    if (s.kind !== "grid") throw new Error("kind");
    expect(s.rows).toHaveLength(25);
    expect(s.rows[0]).toBe("P29");
  });

  it("maps open/closed rows to three columns", () => {
    const s = openClosedScene("T", "forms", [{ name: "P", open: 2, closed: 5, overdue: 1 }]);
    if (s.kind !== "grid") throw new Error("kind");
    expect(s.cols.map((c) => c.label)).toEqual(["Open", "Closed", "Overdue"]);
    expect(s.values[0]).toEqual([2, 5, 1]);
  });

  it("labels overdue bars by number with the title as a tooltip note", () => {
    const s = overdueScene("T", [{ number: "43", title: "Leak at level 2", daysOverdue: 12 }]);
    if (s.kind !== "bars") throw new Error("kind");
    expect(s.items[0]).toMatchObject({ label: "#43", note: "Leak at level 2", value: 12 });
  });

  it("reads series values by key and treats missing values as zero", () => {
    const s = seriesScene("T", "x", [{ month: "2026-01", a: 2 }, { month: "2026-02" }] as Array<{ month: string }>, [
      { key: "a", label: "A", colour: "red" },
    ]);
    if (s.kind !== "series") throw new Error("kind");
    expect(s.series[0]?.values).toEqual([2, 0]);
    expect(isEmptyScene(s)).toBe(false);
    const empty = stackedScene("T", "x", [{ month: "2026-01" } as { month: string } & Record<string, number>], ["a"]);
    expect(isEmptyScene(empty)).toBe(true);
  });

  it("gives the gauge a round maximum above the value, and null for no value", () => {
    expect(gaugeScene("T", "days", 40.9)).toMatchObject({ kind: "gauge", max: 70 });
    expect(gaugeScene("T", "days", null)).toBeNull();
  });

  it("drops globe points without coordinates or records", () => {
    const s = globeScene("T", "issues", [
      { name: "A", lat: 51.5, lon: -0.1, total: 3, open: 1 },
      { name: "B", lat: Number.NaN, lon: 0, total: 3, open: 1 },
      { name: "C", lat: 50, lon: 0, total: 0, open: 0 },
    ]);
    if (s.kind !== "globe") throw new Error("kind");
    expect(s.spots.map((p) => p.label)).toEqual(["A"]);
  });

  it("places the Greenwich equator point facing +Z and the pole on +Y", () => {
    const [x, y, z] = latLonToXYZ(0, 0, 5);
    expect([x, y, z].map((v) => Math.round(v * 1000) / 1000)).toEqual([0, 0, 5]);
    expect(latLonToXYZ(90, 0, 5)[1]).toBeCloseTo(5);
  });

  it("scales heights to the maximum with a visible floor for small values", () => {
    const h = heightScale([10, 100], 8);
    expect(h(100)).toBe(8);
    expect(h(0)).toBe(0);
    expect(h(1)).toBeCloseTo(0.16);
  });
});
