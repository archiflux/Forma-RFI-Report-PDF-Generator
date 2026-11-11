import { describe, expect, it } from "vitest";
import { COOKIE, endSession, refreshSession, seal, startSession, unseal, type SessionEnv } from "./session-handlers";

const env = (secret?: string): SessionEnv => ({ clientId: "cid", scopes: "data:read", secret, cookiePath: "/api/auth", secure: true });

function req(method: string, opts: { cookie?: string; body?: unknown; header?: boolean; origin?: string } = {}): Request {
  const headers: Record<string, string> = {};
  if (opts.header !== false) headers["x-siteboard"] = "1";
  if (opts.cookie) headers.cookie = `${COOKIE}=${encodeURIComponent(opts.cookie)}`;
  if (opts.origin) headers.origin = opts.origin;
  return new Request("https://siteboard.example/api/auth/x", { method, headers, ...(opts.body ? { body: JSON.stringify(opts.body) } : {}) });
}

const cookieValue = (res: Response) => decodeURIComponent((res.headers.get("set-cookie") ?? "").split(";")[0]?.split("=").slice(1).join("=") ?? "");

describe("stay signed in", () => {
  it("seals and unseals, encrypted when a secret is set", () => {
    expect(unseal(seal("rt", undefined), undefined)).toBe("rt");
    const enc = seal("rt", "s3cret");
    expect(enc.startsWith("e.")).toBe(true);
    expect(enc).not.toContain("rt");
    expect(unseal(enc, "s3cret")).toBe("rt");
    expect(unseal(enc, "wrong")).toBeNull();
    // A plain cookie is refused once a secret is configured.
    expect(unseal(seal("rt", undefined), "s3cret")).toBeNull();
  });

  it("stores the refresh token in an HttpOnly, SameSite=Strict, Secure cookie", async () => {
    const res = await startSession(req("POST", { body: { refreshToken: "rt1" } }), env("k"));
    expect(res.status).toBe(200);
    const c = res.headers.get("set-cookie") ?? "";
    expect(c).toMatch(/HttpOnly/);
    expect(c).toMatch(/SameSite=Strict/);
    expect(c).toMatch(/Secure/);
    expect(c).toMatch(/Path=\/api\/auth/);
    expect(unseal(cookieValue(res), "k")).toBe("rt1");
  });

  it("refuses calls without the page header or from another site", async () => {
    expect((await startSession(req("POST", { body: { refreshToken: "x" }, header: false }), env())).status).toBe(403);
    expect((await startSession(req("POST", { body: { refreshToken: "x" }, origin: "https://evil.example" }), env())).status).toBe(403);
  });

  it("swaps the cookie for an access token and rotates the refresh token", async () => {
    let sent = "";
    const fetchImpl = (async (_u: string, init: RequestInit) => {
      sent = String(init.body);
      return new Response(JSON.stringify({ access_token: "at", refresh_token: "rt2", expires_in: 3600, token_type: "Bearer", scope: "data:read" }), { status: 200 });
    }) as unknown as typeof fetch;
    const res = await refreshSession(req("POST", { cookie: seal("rt1", "k") }), env("k"), fetchImpl);
    expect(res.status).toBe(200);
    expect(sent).toContain("refresh_token=rt1");
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.accessToken).toBe("at");
    expect(JSON.stringify(body)).not.toContain("rt2");
    expect(unseal(cookieValue(res), "k")).toBe("rt2");
  });

  it("clears the cookie when Autodesk rejects the refresh token", async () => {
    const fetchImpl = (async () => new Response("{}", { status: 400 })) as unknown as typeof fetch;
    const res = await refreshSession(req("POST", { cookie: seal("old", undefined) }), env(), fetchImpl);
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toMatch(/Max-Age=0/);
  });

  it("revokes and clears on sign-out", async () => {
    let revoked = "";
    const fetchImpl = (async (_u: string, init: RequestInit) => {
      revoked = String(init.body);
      return new Response("", { status: 200 });
    }) as unknown as typeof fetch;
    const res = await endSession(req("DELETE", { cookie: seal("rt9", undefined) }), env(), fetchImpl);
    expect(revoked).toContain("token=rt9");
    expect(res.headers.get("set-cookie")).toMatch(/Max-Age=0/);
  });
});
