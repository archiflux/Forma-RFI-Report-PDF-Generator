import { describe, expect, it, vi } from "vitest";
import { ApsClient } from "@/lib/aps/client";
import {
  inferCustomAttributesFromRfis,
  listCustomAttributes,
  mergeCustomAttributes,
} from "@/lib/aps/rfis";
import type { Rfi } from "@/lib/aps/types";

function rfi(custom: Record<string, unknown>): Rfi {
  return {
    id: `r-${Math.random()}`,
    number: "RFI-0001",
    title: "",
    status: "open",
    createdAt: "2026-01-01T00:00:00Z",
    customAttributes: custom,
    attachmentCount: 0,
  };
}

describe("listCustomAttributes — permission handling", () => {
  it("returns the definitions when APS responds 200", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({ results: [{ id: "a", name: "A", dataType: "text" }] }),
        { status: 200 },
      ),
    );
    const client = new ApsClient({
      getAccessToken: () => "t",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const attrs = await listCustomAttributes(client, "p");
    expect(attrs).toHaveLength(1);
    expect(attrs[0]?.id).toBe("a");
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

  it("guesses dataType from sample shape", () => {
    const out = inferCustomAttributesFromRfis([
      rfi({
        txt: "hello",
        num: 3.14,
        multi: ["a"],
        single: { id: "choice", label: "C" },
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
