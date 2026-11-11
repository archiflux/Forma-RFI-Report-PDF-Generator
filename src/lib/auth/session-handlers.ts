// "Stay signed in": the Autodesk refresh token lives in an HttpOnly cookie
// that page scripts can't read, so closing the tab or browser no longer
// signs people out. The server swaps it for a fresh access token on
// request and rotates it (APS refresh tokens are single use). Framework-free
// so it can be unit tested; the route handlers in app/api/auth call these.
//
// If SESSION_SECRET is set, the cookie is also encrypted (AES-256-GCM).

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { APS_OAUTH, APS_SCOPES_READ_ONLY } from "@/lib/aps/config";

export const COOKIE = "sb_session";
// APS refresh tokens last 15 days; each refresh issues a new one, so anyone
// who opens Siteboard at least once a fortnight stays signed in.
export const MAX_AGE_S = 15 * 24 * 60 * 60;
const MAX_TOKEN_LEN = 4096;

export interface SessionEnv {
  clientId: string;
  scopes: string;
  secret: string | undefined;
  cookiePath: string;
  secure: boolean;
}

export function readSessionEnv(): SessionEnv {
  const base = (process.env.NEXT_BASE_PATH ?? "").replace(/\/$/, "");
  return {
    clientId: process.env.NEXT_PUBLIC_APS_CLIENT_ID ?? "",
    scopes: process.env.NEXT_PUBLIC_APS_SCOPES ?? APS_SCOPES_READ_ONLY.join(" "),
    secret: process.env.SESSION_SECRET || undefined,
    cookiePath: `${base}/api/auth`,
    secure: process.env.NODE_ENV === "production",
  };
}

// ---- cookie sealing

function key(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

export function seal(value: string, secret: string | undefined): string {
  if (!secret) return `p.${Buffer.from(value).toString("base64url")}`;
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(secret), iv);
  const ct = Buffer.concat([c.update(value, "utf8"), c.final()]);
  return `e.${Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64url")}`;
}

export function unseal(raw: string, secret: string | undefined): string | null {
  try {
    if (raw.startsWith("p.")) return secret ? null : Buffer.from(raw.slice(2), "base64url").toString("utf8");
    if (!raw.startsWith("e.") || !secret) return null;
    const buf = Buffer.from(raw.slice(2), "base64url");
    const d = createDecipheriv("aes-256-gcm", key(secret), buf.subarray(0, 12));
    d.setAuthTag(buf.subarray(12, 28));
    return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

function readCookie(req: Request): string | null {
  const header = req.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === COOKIE) return decodeURIComponent(v.join("="));
  }
  return null;
}

function cookieHeader(env: SessionEnv, value: string, maxAge: number): string {
  return [
    `${COOKIE}=${encodeURIComponent(value)}`,
    `Path=${env.cookiePath}`,
    `Max-Age=${maxAge}`,
    "HttpOnly",
    "SameSite=Strict",
    ...(env.secure ? ["Secure"] : []),
  ].join("; ");
}

function json(status: number, body: unknown, setCookie?: string): Response {
  const headers: Record<string, string> = { "Content-Type": "application/json", "Cache-Control": "no-store" };
  if (setCookie) headers["Set-Cookie"] = setCookie;
  return new Response(JSON.stringify(body), { status, headers });
}

// Only our own pages may call these (SameSite=Strict covers the cookie;
// this also blocks cross-site form posts and scripted calls).
function sameOrigin(req: Request): boolean {
  if (req.headers.get("x-siteboard") !== "1") return false;
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(req.url).host;
  } catch {
    return false;
  }
}

// ---- handlers

// POST { refreshToken }: remember the session after sign-in.
export async function startSession(req: Request, env: SessionEnv): Promise<Response> {
  if (!sameOrigin(req)) return json(403, { error: "Forbidden" });
  let body: { refreshToken?: unknown };
  try {
    body = (await req.json()) as { refreshToken?: unknown };
  } catch {
    return json(400, { error: "Bad request" });
  }
  const t = body.refreshToken;
  if (typeof t !== "string" || !t || t.length > MAX_TOKEN_LEN) return json(400, { error: "Bad request" });
  return json(200, { ok: true }, cookieHeader(env, seal(t, env.secret), MAX_AGE_S));
}

// POST: swap the remembered session for a fresh access token.
export async function refreshSession(req: Request, env: SessionEnv, fetchImpl: typeof fetch = fetch): Promise<Response> {
  if (!sameOrigin(req)) return json(403, { error: "Forbidden" });
  const raw = readCookie(req);
  const refreshToken = raw ? unseal(raw, env.secret) : null;
  if (!refreshToken || !env.clientId) return json(401, { error: "Not signed in" }, raw ? cookieHeader(env, "", 0) : undefined);

  const res = await fetchImpl(APS_OAUTH.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: env.clientId, scope: env.scopes }),
  });
  if (!res.ok) return json(401, { error: "Session expired" }, cookieHeader(env, "", 0));
  const t = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number; token_type: string; scope: string };
  // The new refresh token replaces the old (single use); the access token
  // goes to the page, the refresh token never does.
  return json(
    200,
    { accessToken: t.access_token, expiresIn: t.expires_in, tokenType: t.token_type, scope: t.scope },
    cookieHeader(env, seal(t.refresh_token ?? refreshToken, env.secret), MAX_AGE_S),
  );
}

// DELETE: sign out — revoke the refresh token at Autodesk and forget it.
export async function endSession(req: Request, env: SessionEnv, fetchImpl: typeof fetch = fetch): Promise<Response> {
  if (!sameOrigin(req)) return json(403, { error: "Forbidden" });
  const raw = readCookie(req);
  const refreshToken = raw ? unseal(raw, env.secret) : null;
  if (refreshToken && env.clientId) {
    try {
      await fetchImpl(APS_OAUTH.revokeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: refreshToken, token_type_hint: "refresh_token", client_id: env.clientId }),
      });
    } catch {
      // Best effort: the cookie is cleared regardless.
    }
  }
  return json(200, { ok: true }, cookieHeader(env, "", 0));
}
