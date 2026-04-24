import { describe, expect, it, vi } from "vitest";
import { ApsClient } from "@/lib/aps/client";
import {
  inferCustomAttributesFromRfis,
  normalizeCustomAttributes,
  normalizeRfi,
  searchRfisPage,
} from "@/lib/aps/rfis";

describe("normalizeCustomAttributes", () => {
  it("returns {} for null / undefined / non-objects", () => {
    expect(normalizeCustomAttributes(null)).toEqual({});
    expect(normalizeCustomAttributes(undefined)).toEqual({});
    expect(normalizeCustomAttributes("oops")).toEqual({});
    expect(normalizeCustomAttributes(42)).toEqual({});
  });

  it("passes record form through unchanged", () => {
    expect(normalizeCustomAttributes({ a: "x", b: 2 })).toEqual({ a: "x", b: 2 });
  });

  it("collapses the APS array-of-objects form into a record keyed by attributeDefinitionId", () => {
    const input = [
      { attributeDefinitionId: "attr-1", value: "hello", type: "text" },
      { attributeDefinitionId: "attr-2", value: 42, type: "numeric" },
      { attributeDefinitionId: "attr-3", value: ["c1", "c2"], type: "multiChoice" },
    ];
    expect(normalizeCustomAttributes(input)).toEqual({
      "attr-1": "hello",
      "attr-2": 42,
      "attr-3": ["c1", "c2"],
    });
  });

  it("also accepts `id` instead of `attributeDefinitionId` (APS has shipped both)", () => {
    const input = [{ id: "abc", value: "x" }];
    expect(normalizeCustomAttributes(input)).toEqual({ abc: "x" });
  });

  it("falls back to `values` if `value` is absent", () => {
    expect(
      normalizeCustomAttributes([{ attributeDefinitionId: "a", values: ["x", "y"] }]),
    ).toEqual({ a: ["x", "y"] });
  });

  it("skips malformed array entries without throwing", () => {
    const input = [
      null,
      { attributeDefinitionId: "good", value: 1 },
      { value: "missing id" }, // skipped — no id
      "junk",
    ];
    expect(normalizeCustomAttributes(input)).toEqual({ good: 1 });
  });
});

describe("normalizeRfi", () => {
  it("produces defaults for missing fields", () => {
    const r = normalizeRfi({});
    expect(r.id).toBe("");
    expect(r.number).toBe("");
    expect(r.title).toBe("");
    expect(r.status).toBe("");
    expect(r.customAttributes).toEqual({});
    expect(r.attachmentCount).toBe(0);
  });

  it("normalises assignee and manager to { id, name }", () => {
    const r = normalizeRfi({
      assignee: { userId: "u1", displayName: "Alice" },
      manager: { id: "u2", name: "Bob" },
    });
    expect(r.assignee).toEqual({ id: "u1", name: "Alice" });
    expect(r.manager).toEqual({ id: "u2", name: "Bob" });
  });

  it("falls back to `assignedTo` when `assignee` is missing", () => {
    const r = normalizeRfi({ assignedTo: { id: "u", name: "X" } });
    expect(r.assignee).toEqual({ id: "u", name: "X" });
  });

  it("derives attachmentCount from attachments array if explicit count is missing", () => {
    const r = normalizeRfi({ attachments: [{}, {}, {}] });
    expect(r.attachmentCount).toBe(3);
  });

  it("collapses array-form customAttributes to a record", () => {
    const r = normalizeRfi({
      customAttributes: [{ attributeDefinitionId: "a", value: "x" }],
    });
    expect(r.customAttributes).toEqual({ a: "x" });
  });

  it("survives a completely hostile raw value", () => {
    expect(() => normalizeRfi(null)).not.toThrow();
    expect(() => normalizeRfi(undefined)).not.toThrow();
    expect(() => normalizeRfi("not an object")).not.toThrow();
  });
});

describe("searchRfisPage uses normalizeRfi on the response", () => {
  it("maps null / array / record customAttributes to record form", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          results: [
            { id: "r1", customAttributes: null },
            {
              id: "r2",
              customAttributes: [
                { attributeDefinitionId: "a", value: "hello" },
              ],
            },
            { id: "r3", customAttributes: { a: "world" } },
          ],
          pagination: { limit: 200, offset: 0, totalResults: 3 },
        }),
        { status: 200 },
      ),
    );
    const client = new ApsClient({
      getAccessToken: () => "t",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const page = await searchRfisPage(client, "p");
    expect(page.results).toHaveLength(3);
    expect(page.results[0]?.customAttributes).toEqual({});
    expect(page.results[1]?.customAttributes).toEqual({ a: "hello" });
    expect(page.results[2]?.customAttributes).toEqual({ a: "world" });
  });
});

describe("inferCustomAttributesFromRfis is defensive", () => {
  it("no-ops over an RFI whose customAttributes is null (cached stale data)", () => {
    // Simulate a stale/cached RFI that somehow bypassed the normaliser.
    const stale = [
      { ...normalizeRfi({}), customAttributes: null as unknown as Record<string, unknown> },
      normalizeRfi({ customAttributes: { a: 1 } }),
    ];
    const out = inferCustomAttributesFromRfis(stale);
    expect(out.map((a) => a.id)).toEqual(["a"]);
  });
});
