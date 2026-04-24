import { describe, expect, it, vi } from "vitest";
import { proxyApsRequest } from "@/lib/aps/proxy";

function req(
  overrides: Partial<Parameters<typeof proxyApsRequest>[0]> & {
    fetchCalls?: Array<{ url: string; init: RequestInit | undefined }>;
  } = {},
): Parameters<typeof proxyApsRequest>[0] {
  const calls = overrides.fetchCalls;
  const fetchImpl =
    overrides.fetchImpl ??
    (vi.fn(async (url: string, init?: RequestInit) => {
      calls?.push({ url, init });
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as unknown as typeof fetch);
  return {
    method: overrides.method ?? "GET",
    path: overrides.path ?? "/project/v1/hubs",
    query: overrides.query ?? new URLSearchParams(),
    authorization:
      overrides.authorization === undefined ? "Bearer token" : overrides.authorization,
    body: overrides.body,
    fetchImpl,
  };
}

describe("proxyApsRequest — read-only contract (server-side)", () => {
  it("allows GET", async () => {
    const res = await proxyApsRequest(req({ method: "GET" }));
    expect(res.status).toBe(200);
  });

  it("allows the one documented POST (search:rfis)", async () => {
    const res = await proxyApsRequest(
      req({
        method: "POST",
        path: "/construction/rfis/v3/projects/abc/search:rfis",
        body: "{}",
      }),
    );
    expect(res.status).toBe(200);
  });

  it("rejects PUT, PATCH, DELETE", async () => {
    for (const m of ["PUT", "PATCH", "DELETE"]) {
      const res = await proxyApsRequest(req({ method: m }));
      expect(res.status).toBe(405);
    }
  });

  it("rejects a POST that isn't search:rfis", async () => {
    const res = await proxyApsRequest(
      req({
        method: "POST",
        path: "/construction/rfis/v3/projects/abc/rfis",
        body: "{}",
      }),
    );
    expect(res.status).toBe(405);
  });

  it("rejects requests without an Authorization header", async () => {
    const res = await proxyApsRequest(req({ authorization: null }));
    expect(res.status).toBe(401);
  });

  it("forwards the bearer token to APS", async () => {
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    await proxyApsRequest(req({ fetchCalls: calls, authorization: "Bearer abc" }));
    const headers = calls[0]?.init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer abc");
  });

  it("builds the upstream URL against developer.api.autodesk.com", async () => {
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    await proxyApsRequest(
      req({
        fetchCalls: calls,
        path: "/construction/rfis/v3/projects/xyz/attributes",
      }),
    );
    expect(calls[0]?.url).toBe(
      "https://developer.api.autodesk.com/construction/rfis/v3/projects/xyz/attributes",
    );
  });

  it("forwards query parameters", async () => {
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    const query = new URLSearchParams({ foo: "bar", limit: "10" });
    await proxyApsRequest(req({ fetchCalls: calls, query }));
    expect(calls[0]?.url).toContain("foo=bar");
    expect(calls[0]?.url).toContain("limit=10");
  });

  it("does not leak upstream response headers other than content-type", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response("{}", {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": "secret=leaked",
          "X-RateLimit-Remaining": "99",
        },
      }),
    );
    const res = await proxyApsRequest(req({ fetchImpl: fetchImpl as unknown as typeof fetch }));
    expect(res.headers.get("content-type")).toBe("application/json");
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(res.headers.get("x-ratelimit-remaining")).toBeNull();
  });
});
