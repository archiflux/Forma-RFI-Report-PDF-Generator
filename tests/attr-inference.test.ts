import { describe, expect, it, vi } from "vitest";
import { ApsClient } from "@/lib/aps/client";
import {
  inferCustomAttributesFromRfis,
  listCustomAttributes,
  mergeCustomAttributes,
} from "@/lib/aps/rfis";
import type { Rfi } from "@/lib/aps/types";

function asValuesRecord(custom: Record<string, unknown>): Record<string, unknown[]> {
  const out: Record<string, unknown[]> = {};
  for (const [k, v] of Object.entries(custom)) {
    out[k] = Array.isArray(v) ? v : [v];
  }
  return out;
}

function rfi(custom: Record<string, unknown>): Rfi {
  return {
    id: `r-${Math.random()}`,
    number: "RFI-0001",
    title: "",
    status: "open",
    createdAt: "2026-01-01T00:00:00Z",
    customAttributes: asValuesRecord(custom),
    assignees: [],
    attachments: [],
    attachmentCount: 0,
  };
}

describe("listCustomAttributes — permission handling", () => {
  it("parses APS's actual response shape (type + multipleChoice + possibleValues)", async () => {
    // Mirrors the documented shape from the APS Postman collection:
    //   { id, name, type, multipleChoice, possibleValues: [{ id, name }] }
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          results: [
            { id: "txt", name: "Notes", type: "text", multipleChoice: false, possibleValues: [] },
            { id: "num", name: "Cost", type: "numeric", multipleChoice: false, possibleValues: [] },
            {
              id: "disc",
              name: "Discipline",
              type: "text",
              multipleChoice: false,
              possibleValues: [
                { id: "arch", name: "Architecture" },
                { id: "struct", name: "Structural" },
              ],
            },
            {
              id: "tags",
              name: "Tags",
              type: "text",
              multipleChoice: true,
              possibleValues: [
                { id: "urgent", name: "Urgent" },
                { id: "external", name: "External" },
              ],
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const client = new ApsClient({
      getAccessToken: () => "t",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const attrs = await listCustomAttributes(client, "p");
    expect(attrs).toHaveLength(4);
    const by = Object.fromEntries(attrs.map((a) => [a.id, a]));
    expect(by.txt?.name).toBe("Notes");
    expect(by.txt?.dataType).toBe("text");
    expect(by.num?.dataType).toBe("numeric");
    expect(by.disc?.dataType).toBe("singleChoice");
    expect(by.disc?.values).toEqual([
      { id: "arch", label: "Architecture" },
      { id: "struct", label: "Structural" },
    ]);
    expect(by.tags?.dataType).toBe("multiChoice");
    expect(by.tags?.values).toHaveLength(2);
  });

  it("skips definitions missing an id", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({ results: [{ name: "no id" }, { id: "ok", name: "OK", type: "text" }] }),
        { status: 200 },
      ),
    );
    const client = new ApsClient({
      getAccessToken: () => "t",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const attrs = await listCustomAttributes(client, "p");
    expect(attrs.map((a) => a.id)).toEqual(["ok"]);
  });

  it("returns [] on 403 so callers can degrade gracefully", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ error: "forbidden" }), { status: 403 }),
    );
    const client = new ApsClient({
      getAccessToken: () => "t",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const attrs = await listCustomAttributes(client, "p");
    expect(attrs).toEqual([]);
  });

  it("returns [] on 401", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 }),
    );
    const client = new ApsClient({
      getAccessToken: () => "t",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const attrs = await listCustomAttributes(client, "p");
    expect(attrs).toEqual([]);
  });

  it("still throws on server errors (500) so they aren't silently swallowed", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response("internal", { status: 500 }),
    );
    const client = new ApsClient({
      getAccessToken: () => "t",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await expect(listCustomAttributes(client, "p")).rejects.toMatchObject({
      status: 500,
    });
  });
});

describe("inferCustomAttributesFromRfis", () => {
  it("returns one def per unique custom-attribute id across all RFIs", () => {
    const out = inferCustomAttributesFromRfis([
      rfi({ a: "x", b: 42 }),
      rfi({ a: "y", c: ["u", "v"] }),
    ]);
    expect(out.map((a) => a.id).sort()).toEqual(["a", "b", "c"]);
    expect(out.every((a) => a.inferred)).toBe(true);
    expect(out.every((a) => a.name === a.id)).toBe(true);
  });

  it("guesses dataType from sample shape (length + element type)", () => {
    const out = inferCustomAttributesFromRfis([
      rfi({
        txt: "hello",
        num: 3.14,
        multi: ["a", "b"], // 2+ elements → multiChoice
        single: ["12345678-1234-1234-1234-123456789012"], // 1 UUID → singleChoice
      }),
    ]);
    const by = Object.fromEntries(out.map((a) => [a.id, a.dataType]));
    expect(by).toEqual({
      txt: "text",
      num: "numeric",
      multi: "multiChoice",
      single: "singleChoice",
    });
  });

  it("returns nothing when no RFI carries custom attributes", () => {
    expect(inferCustomAttributesFromRfis([rfi({})])).toEqual([]);
    expect(inferCustomAttributesFromRfis([])).toEqual([]);
  });
});

describe("mergeCustomAttributes", () => {
  it("prefers fetched defs (full fidelity) over inferred ones", () => {
    const fetched = [
      { id: "a", name: "Alpha", dataType: "singleChoice" as const, values: [{ id: "x", label: "X" }] },
    ];
    const merged = mergeCustomAttributes(fetched, [rfi({ a: "x" })]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.name).toBe("Alpha");
    expect(merged[0]?.values).toHaveLength(1);
    expect(merged[0]?.inferred).toBeUndefined();
  });

  it("appends inferred defs for IDs the fetched list missed", () => {
    const fetched = [{ id: "a", name: "Alpha", dataType: "text" as const }];
    const merged = mergeCustomAttributes(fetched, [rfi({ a: "x", orphan: 1 })]);
    expect(merged.map((a) => a.id).sort()).toEqual(["a", "orphan"]);
    const orphan = merged.find((a) => a.id === "orphan");
    expect(orphan?.inferred).toBe(true);
    expect(orphan?.dataType).toBe("numeric");
  });

  it("returns inferred-only when fetched is empty (the 403 fallback path)", () => {
    const merged = mergeCustomAttributes([], [rfi({ foo: "bar" })]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.inferred).toBe(true);
  });
});
