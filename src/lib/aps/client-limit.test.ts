import { describe, expect, it } from "vitest";
import { ApsClient } from "./client";

describe("ApsClient request limits", () => {
  it("never has more requests in flight than the cap", async () => {
    let inFlight = 0;
    let peak = 0;
    const fetchImpl = (async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as unknown as typeof fetch;
    const client = new ApsClient({ getAccessToken: () => "t", fetchImpl, baseUrl: "https://example.test", maxConcurrent: 3 });
    await Promise.all(Array.from({ length: 20 }, () => client.request({ path: "/x" })));
    expect(peak).toBe(3);
  });

  it("uses a refreshed token when one is available", async () => {
    let auth = "";
    const fetchImpl = (async (_u: string, init: RequestInit) => {
      auth = (init.headers as Record<string, string>).Authorization ?? "";
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    const client = new ApsClient({ getAccessToken: () => "stale", getFreshToken: async () => "fresh", fetchImpl, baseUrl: "https://example.test" });
    await client.request({ path: "/x" });
    expect(auth).toBe("Bearer fresh");
  });
});
