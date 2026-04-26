import { describe, expect, it, vi } from "vitest";
import { ApsClient } from "@/lib/aps/client";
import { scrapeAllRfis } from "@/lib/aps/rfis";
import type { Rfi } from "@/lib/aps/types";

function makeRfi(i: number): Rfi {
  return {
    id: `rfi-${i}`,
    number: `RFI-${String(i).padStart(4, "0")}`,
    title: `Title ${i}`,
    status: "open",
    createdAt: "2026-01-01T00:00:00Z",
    customAttributes: {},
    assignees: [],
    attachments: [],
    attachmentCount: 0,
  };
}

describe("scrapeAllRfis pagination walker", () => {
  it("keeps paging while results === limit and stops when a short page arrives", async () => {
    const PAGE = 200;
    const TOTAL = 450;
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        offset: number;
        limit: number;
      };
      const start = body.offset;
      const end = Math.min(start + body.limit, TOTAL);
      const results = [];
      for (let i = start; i < end; i++) results.push(makeRfi(i));
      return new Response(
        JSON.stringify({
          results,
          pagination: { limit: body.limit, offset: body.offset, totalResults: TOTAL },
        }),
        { status: 200 },
      );
    });

    const client = new ApsClient({
      getAccessToken: () => "t",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const all = await scrapeAllRfis(client, "b.project-123");
    expect(all).toHaveLength(TOTAL);
    // Expect 3 pages: [0..199], [200..399], [400..449]
    expect(fetchImpl).toHaveBeenCalledTimes(Math.ceil(TOTAL / PAGE));
  });

  it("reports progress with loaded + total", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          results: [makeRfi(0), makeRfi(1)],
          pagination: { limit: 200, offset: 0, totalResults: 2 },
        }),
        { status: 200 },
      ),
    );
    const client = new ApsClient({
      getAccessToken: () => "t",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const events: Array<{ loaded: number; total?: number }> = [];
    await scrapeAllRfis(client, "p", undefined, undefined, (p) => events.push(p));
    expect(events.at(-1)).toEqual({ loaded: 2, total: 2 });
  });

  it("hits the read-shaped search:rfis POST, never any other verb", async () => {
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      expect(url).toContain("/construction/rfis/v3/projects/");
      expect(url).toContain("/search:rfis");
      return new Response(
        JSON.stringify({ results: [], pagination: { limit: 200, offset: 0 } }),
        { status: 200 },
      );
    });
    const client = new ApsClient({
      getAccessToken: () => "t",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await scrapeAllRfis(client, "b.project-abc");
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("strips the 'b.' prefix from project ids before hitting RFI endpoints", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      expect(url).toContain("/projects/project-abc/search:rfis");
      expect(url).not.toContain("/projects/b.project-abc/");
      return new Response(
        JSON.stringify({ results: [], pagination: { limit: 200, offset: 0 } }),
        { status: 200 },
      );
    });
    const client = new ApsClient({
      getAccessToken: () => "t",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await scrapeAllRfis(client, "b.project-abc");
  });
});
