import { describe, expect, it } from "vitest";
import type { ApsClient } from "./client";
import { scrapePaged } from "./paged";
import { ApsError } from "./types";

// Fake endpoint holding `n` items; rejects pages bigger than `maxPage`.
function fake(n: number, opts: { maxPage?: number; total?: boolean } = {}) {
  const calls: Array<{ limit: number; offset: number }> = [];
  let inFlight = 0;
  let peak = 0;
  const client = {
    async request({ query }: { query: { limit: number; offset: number } }) {
      calls.push({ limit: query.limit, offset: query.offset });
      if (opts.maxPage && query.limit > opts.maxPage) throw new ApsError("bad limit", 400);
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight--;
      const results = Array.from({ length: Math.max(0, Math.min(query.limit, n - query.offset)) }, (_, i) => query.offset + i);
      return { results, ...(opts.total === false ? {} : { pagination: { totalResults: n } }) };
    },
  } as unknown as ApsClient;
  return { client, calls, peak: () => peak };
}

describe("scrapePaged", () => {
  it("asks for big pages and loads the rest in parallel once the total is known", async () => {
    const f = fake(1000);
    const out = await scrapePaged(f.client, "/x/projects/a/issues", { page: 200, fallbackPage: 100, max: 5000 });
    expect(out).toEqual(Array.from({ length: 1000 }, (_, i) => i));
    expect(f.calls).toHaveLength(5);
    expect(f.peak()).toBeGreaterThan(1);
  });

  it("drops back to the safe page size if the big one is rejected, and remembers", async () => {
    const f = fake(250, { maxPage: 100 });
    const out = await scrapePaged(f.client, "/y/projects/a/items", { page: 200, fallbackPage: 100, max: 5000 });
    expect(out).toHaveLength(250);
    const f2 = fake(50, { maxPage: 100 });
    await scrapePaged(f2.client, "/y/projects/b/items", { page: 200, fallbackPage: 100, max: 5000 });
    expect(f2.calls[0]?.limit).toBe(100);
  });

  it("reads page by page when no total is given, and stops at max", async () => {
    const f = fake(500, { total: false });
    const out = await scrapePaged(f.client, "/z/projects/a/forms", { page: 50, max: 120 });
    expect(out).toHaveLength(120);
    expect(f.peak()).toBe(1);
  });
});
