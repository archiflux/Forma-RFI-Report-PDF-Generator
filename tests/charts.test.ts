import { describe, expect, it } from "vitest";
import { squarify } from "@/lib/charts/treemap";
import { averageDays, monthlyByCategory, topOverdue } from "@/lib/charts/series";

describe("squarify", () => {
  it("fills the box with areas proportional to value", () => {
    const data = [6, 6, 4, 3, 2, 2, 1].map((v, i) => ({ id: i, v }));
    const rects = squarify(data, (d) => d.v, 600, 400);
    expect(rects).toHaveLength(7);
    const area = rects.reduce((s, r) => s + r.w * r.h, 0);
    expect(area).toBeCloseTo(600 * 400, 3);
    for (const r of rects) {
      expect(r.w * r.h).toBeCloseTo((r.item.v / 24) * 600 * 400, 3);
      expect(r.x).toBeGreaterThanOrEqual(-1e-9);
      expect(r.x + r.w).toBeLessThanOrEqual(600 + 1e-6);
      expect(r.y + r.h).toBeLessThanOrEqual(400 + 1e-6);
    }
  });

  it("skips zeros and handles empty or zero-size boxes", () => {
    expect(squarify([{ v: 0 }], (d) => d.v, 100, 100)).toEqual([]);
    expect(squarify([{ v: 1 }], (d) => d.v, 0, 100)).toEqual([]);
  });
});

describe("series helpers", () => {
  it("stacks months by category, folding the tail into Other", () => {
    const items = [
      { d: "2026-01-02", s: "A" }, { d: "2026-01-03", s: "A" }, { d: "2026-03-01", s: "B" },
      { d: "2026-03-01", s: "C" }, { d: "2026-03-02", s: "D" }, { d: "bad", s: "A" },
    ];
    const r = monthlyByCategory(items, (x) => x.d, (x) => x.s, 3);
    expect(r.categories).toEqual(["A", "B", "Other"]);
    expect(r.rows).toEqual([
      { month: "2026-01", A: 2, B: 0, Other: 0 },
      { month: "2026-02", A: 0, B: 0, Other: 0 },
      { month: "2026-03", A: 0, B: 1, Other: 2 },
    ]);
  });

  it("ranks open overdue items and ignores closed or not-yet-due ones", () => {
    const now = new Date("2026-10-26T12:00:00Z");
    const items = [
      { id: 1, open: true, due: "2026-10-01" },
      { id: 2, open: true, due: "2026-09-01" },
      { id: 3, open: false, due: "2026-01-01" },
      { id: 4, open: true, due: "2026-10-26" },
      { id: 5, open: true },
    ];
    const r = topOverdue(items, (x) => x.open, (x) => (x as { due?: string }).due, now);
    expect(r.map((x) => [x.item.id, x.daysOverdue])).toEqual([[2, 55], [1, 25]]);
  });

  it("averages days between dates, skipping incomplete pairs", () => {
    expect(averageDays([{ a: "2026-01-01", b: "2026-01-11" }, { a: "2026-01-01", b: "2026-01-21" }, { a: "2026-01-01" }], (x) => x.a, (x) => (x as { b?: string }).b)).toBe(15);
    expect(averageDays([], () => undefined, () => undefined)).toBeNull();
  });
});
