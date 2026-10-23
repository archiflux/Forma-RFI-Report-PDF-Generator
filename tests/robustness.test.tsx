import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { normalizeRfi } from "@/lib/aps/rfis";
import { rfisConfig, toRfiRecord } from "@/lib/rfis-dash/config";
import { countBy, gapFill, monthlyCounts } from "@/lib/dashboard/aggregate";
import { asText } from "@/lib/generic/text";
import { GenericView } from "@/components/generic/generic-view";

const NOW = new Date("2026-10-23T12:00:00Z");

describe("non-text API values", () => {
  it("asText flattens arrays and named objects", () => {
    expect(asText(["Structural", "MEP"])).toBe("Structural, MEP");
    expect(asText({ id: "1", name: "High" })).toBe("High");
    expect(asText([])).toBeUndefined();
    expect(asText(null)).toBeUndefined();
  });

  it("RFI dashboard renders when category/priority arrive as arrays or objects", () => {
    // Two RFIs tie on category count, which is what used to hit
    // localeCompare on an array and crash the page.
    const items = [
      { id: "a", category: ["Design"], priority: { id: "p", name: "High" } },
      { id: "b", category: ["Site"], priority: "Low", status: { name: "open" } },
    ].map((raw) => toRfiRecord(normalizeRfi({ title: "T", createdAt: "2026-09-01T00:00:00Z", ...raw }), "p1", "P"));
    expect(items[0]).toMatchObject({ category: "Design", priority: "High" });
    expect(items[1]?.status).toBe("open");
    const html = renderToString(<GenericView cfg={rfisConfig} dataset={{ projects: [{ id: "p1", name: "P", count: 2 }], items }} now={NOW} />);
    expect(html).toContain("Design");
  });

  it("countBy tolerates non-string keys", () => {
    const keyed = [{ k: ["a"] }, { k: ["b"] }] as unknown as Array<{ k: string }>;
    expect(countBy(keyed, (x) => x.k).map((c) => c.label)).toEqual(["a", "b"]);
  });

  it("ignores malformed dates in monthly series", () => {
    expect(gapFill(["NaN-NaN", "2026-01", "Tue Oct", "2026-03"])).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(monthlyCounts([{ d: "garbage" }, { d: "2026-05-02" }], (x) => x.d)).toEqual([{ month: "2026-05", count: 1 }]);
  });
});

describe("project ordering", () => {
  it("sorts names alphabetically with numbers in natural order", async () => {
    const { sortByName } = await import("@/lib/aps/projects");
    expect(sortByName([{ name: "36025 - WBC" }, { name: "Amicie's Sandbox" }, { name: "9 - Early" }, { name: "34188 - 6PR" }, { name: "amber" }]).map((p) => p.name)).toEqual([
      "9 - Early",
      "34188 - 6PR",
      "36025 - WBC",
      "amber",
      "Amicie's Sandbox",
    ]);
  });
});
