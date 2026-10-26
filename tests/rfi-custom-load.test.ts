import { describe, expect, it } from "vitest";
import { normalizeRfi } from "@/lib/aps/rfis";
import { withCustomFields } from "@/lib/rfis-dash/config";
import { createLimiter } from "@/lib/generic/limit";

describe("loading RFI custom fields", () => {
  const slim = [normalizeRfi({ id: "a", title: "A" }), normalizeRfi({ id: "b", title: "B" }), normalizeRfi({ id: "c", title: "C" })];

  it("takes custom fields from the per-RFI detail and keeps the rest", async () => {
    const seen: string[] = [];
    const progress: Array<[number, number]> = [];
    const out = await withCustomFields(
      slim,
      async (id) => {
        seen.push(id);
        if (id === "c") throw new Error("403");
        return normalizeRfi({ id, title: "detail title", customAttributes: [{ id: "x", name: "Package", values: [id] }] });
      },
      (d, t) => progress.push([d, t]),
    );
    expect(seen.sort()).toEqual(["a", "b", "c"]);
    expect(out[0]).toMatchObject({ title: "A", customAttributes: { x: ["a"] } });
    expect(out[0]?.customAttributesMeta?.x?.name).toBe("Package");
    expect(out[2]).toBe(slim[2]); // failure keeps the search record
    expect(progress.at(-1)).toEqual([3, 3]);
  });

  it("skips the detail fetch when search already has custom fields", async () => {
    const rich = [normalizeRfi({ id: "a", customAttributes: [{ id: "x", values: ["1"] }] })];
    let calls = 0;
    await withCustomFields(rich, async () => {
      calls++;
      return rich[0]!;
    });
    expect(calls).toBe(0);
  });
});

describe("limiter", () => {
  it("never runs more than the cap at once", async () => {
    const limit = createLimiter(2);
    let active = 0;
    let peak = 0;
    await Promise.all(
      Array.from({ length: 7 }, () =>
        limit(async () => {
          active++;
          peak = Math.max(peak, active);
          await new Promise((r) => setTimeout(r, 5));
          active--;
        }),
      ),
    );
    expect(peak).toBe(2);
  });
});
