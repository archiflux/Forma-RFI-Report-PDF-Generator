import { describe, expect, it, vi } from "vitest";
import { ApsClient } from "@/lib/aps/client";
import {
  hydrateRfis,
  inferCustomAttributesFromRfis,
  normalizeCustomAttributes,
  normalizeRfi,
  rfisHaveCustomAttributes,
  searchRfisPage,
} from "@/lib/aps/rfis";
import type { Rfi } from "@/lib/aps/types";

describe("normalizeCustomAttributes", () => {
  it("returns {} for null / undefined / non-objects", () => {
    expect(normalizeCustomAttributes(null)).toEqual({});
    expect(normalizeCustomAttributes(undefined)).toEqual({});
    expect(normalizeCustomAttributes("oops")).toEqual({});
    expect(normalizeCustomAttributes(42)).toEqual({});
  });

  it("collapses APS v3 array form { id, values: [...] } into a record of values arrays", () => {
    const input = [
      { id: "attr-text", values: ["hello"] },
      { id: "attr-num", values: [42] },
      { id: "attr-multi", values: ["c1", "c2"] },
    ];
    expect(normalizeCustomAttributes(input)).toEqual({
      "attr-text": ["hello"],
      "attr-num": [42],
      "attr-multi": ["c1", "c2"],
    });
  });

  it("accepts `attributeDefinitionId` as an alias for `id`", () => {
    expect(
      normalizeCustomAttributes([{ attributeDefinitionId: "abc", values: ["x"] }]),
    ).toEqual({ abc: ["x"] });
  });

  it("accepts `value` (singular) as an alias for `values`", () => {
    expect(
      normalizeCustomAttributes([{ id: "a", value: "lone" }]),
    ).toEqual({ a: ["lone"] });
  });

  it("wraps record-form scalar values in single-element arrays", () => {
    expect(normalizeCustomAttributes({ a: "x", b: 2 })).toEqual({
      a: ["x"],
      b: [2],
    });
  });

  it("strips null / undefined entries from values arrays", () => {
    expect(
      normalizeCustomAttributes([{ id: "a", values: ["x", null, "y", undefined] }]),
    ).toEqual({ a: ["x", "y"] });
  });

  it("skips malformed array entries without throwing", () => {
    const input = [
      null,
      { id: "good", values: [1] },
      { values: ["missing id"] }, // skipped — no id
      "junk",
    ];
    expect(normalizeCustomAttributes(input)).toEqual({ good: [1] });
  });

  it("treats an empty values array as an empty array (not omitted)", () => {
    expect(
      normalizeCustomAttributes([{ id: "a", values: [] }]),
    ).toEqual({ a: [] });
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

  it("normalises assignee/manager via id/userId/autodeskId + name/displayName/email", () => {
    const r = normalizeRfi({
      assignee: { userId: "u1", displayName: "Alice" },
      manager: { id: "u2", name: "Bob" },
    });
    expect(r.assignee).toEqual({ id: "u1", name: "Alice" });
    expect(r.manager).toEqual({ id: "u2", name: "Bob" });
  });

  it("falls back to assignedTo when assignee is missing", () => {
    const r = normalizeRfi({ assignedTo: { id: "u", name: "X" } });
    expect(r.assignee).toEqual({ id: "u", name: "X" });
  });

  it("derives attachmentCount from attachments array if explicit count is missing", () => {
    const r = normalizeRfi({ attachments: [{}, {}, {}] });
    expect(r.attachmentCount).toBe(3);
  });

  it("normalises APS v3 array-form customAttributes to record-of-values-arrays", () => {
    const r = normalizeRfi({
      customAttributes: [
        { id: "txt", values: ["hello"] },
        { id: "multi", values: ["c1", "c2"] },
      ],
    });
    expect(r.customAttributes).toEqual({
      txt: ["hello"],
      multi: ["c1", "c2"],
    });
  });

  it("survives null / undefined / non-object input", () => {
    expect(() => normalizeRfi(null)).not.toThrow();
    expect(() => normalizeRfi(undefined)).not.toThrow();
    expect(() => normalizeRfi("not an object")).not.toThrow();
  });
});

describe("searchRfisPage uses normalizeRfi on the response", () => {
  it("normalises every RFI in the response regardless of its customAttributes shape", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          results: [
            { id: "r1", customAttributes: null },
            {
              id: "r2",
              customAttributes: [
                { id: "a", values: ["hello"] },
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
    expect(page.results[1]?.customAttributes).toEqual({ a: ["hello"] });
    expect(page.results[2]?.customAttributes).toEqual({ a: ["world"] });
  });
});

describe("inferCustomAttributesFromRfis", () => {
  it("infers numeric / multi-choice / single-choice / text from values arrays", () => {
    const rfis: Rfi[] = [
      normalizeRfi({
        id: "r",
        customAttributes: [
          { id: "num", values: [42] },
          { id: "multi", values: ["a", "b"] },
          {
            id: "single-uuid",
            values: ["12345678-1234-1234-1234-123456789012"],
          },
          { id: "txt", values: ["just some text"] },
        ],
      }),
    ];
    const out = inferCustomAttributesFromRfis(rfis);
    const by = Object.fromEntries(out.map((a) => [a.id, a.dataType]));
    expect(by).toEqual({
      num: "numeric",
      multi: "multiChoice",
      "single-uuid": "singleChoice",
      txt: "text",
    });
    expect(out.every((a) => a.inferred)).toBe(true);
  });

  it("no-ops over an RFI whose customAttributes is null (stale cache)", () => {
    const stale: Rfi[] = [
      {
        ...normalizeRfi({}),
        customAttributes: null as unknown as Record<string, unknown[]>,
      },
      normalizeRfi({ customAttributes: [{ id: "a", values: [1] }] }),
    ];
    const out = inferCustomAttributesFromRfis(stale);
    expect(out.map((a) => a.id)).toEqual(["a"]);
  });
});

describe("rfisHaveCustomAttributes", () => {
  it("is false when no RFI carries any custom values", () => {
    expect(rfisHaveCustomAttributes([normalizeRfi({})])).toBe(false);
    expect(rfisHaveCustomAttributes([])).toBe(false);
  });
  it("is true once at least one RFI has customAttributes", () => {
    expect(
      rfisHaveCustomAttributes([
        normalizeRfi({}),
        normalizeRfi({ customAttributes: [{ id: "a", values: ["x"] }] }),
      ]),
    ).toBe(true);
  });
});

describe("hydrateRfis", () => {
  it("replaces each RFI in place with its full-detail counterpart and reports progress", async () => {
    const slim: Rfi[] = [
      normalizeRfi({ id: "rfi-1" }),
      normalizeRfi({ id: "rfi-2" }),
      normalizeRfi({ id: "rfi-3" }),
    ];
    const fetchImpl = vi.fn(async (url: string) => {
      const m = url.match(/\/rfis\/(rfi-\d+)$/);
      const id = m?.[1];
      return new Response(
        JSON.stringify({
          id,
          number: id?.toUpperCase(),
          customAttributes: [{ id: "discipline", values: ["Architecture"] }],
        }),
        { status: 200 },
      );
    });
    const client = new ApsClient({
      getAccessToken: () => "t",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const events: Array<{ hydrated: number; total: number }> = [];
    const out = await hydrateRfis(client, "b.proj", slim, (p) => events.push(p));

    expect(out).toHaveLength(3);
    expect(out.map((r) => r.id)).toEqual(["rfi-1", "rfi-2", "rfi-3"]);
    expect(out[0]?.customAttributes).toEqual({ discipline: ["Architecture"] });
    expect(events.at(-1)).toEqual({ hydrated: 3, total: 3 });
  });

  it("falls back to the slim RFI when a single hydrate fails", async () => {
    const slim: Rfi[] = [
      normalizeRfi({ id: "ok-1", title: "Original 1" }),
      normalizeRfi({ id: "broken", title: "Original broken" }),
    ];
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes("/rfis/broken")) {
        return new Response("forbidden", { status: 403 });
      }
      return new Response(
        JSON.stringify({ id: "ok-1", title: "Hydrated 1" }),
        { status: 200 },
      );
    });
    const client = new ApsClient({
      getAccessToken: () => "t",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const out = await hydrateRfis(client, "p", slim);
    expect(out[0]?.title).toBe("Hydrated 1");
    expect(out[1]?.title).toBe("Original broken"); // slim fallback
  });
});
