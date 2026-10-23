// Server logic for hosted snapshots, kept framework-free so it can be unit
// tested. Publishing and managing links needs a valid Autodesk sign-in
// (checked against APS /userprofile) from an allowed email domain; viewing
// a link needs nothing but the unguessable id, and stops at expiry.

import { randomBytes } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import { APS_BASE_URL } from "@/lib/aps/config";
import type { SnapshotStore } from "./store";
import { EXPIRY_DAYS, MAX_SNAPSHOT_BYTES, type SharedSnapshot, type SnapshotKind, type SnapshotMeta } from "./types";

const KINDS: readonly SnapshotKind[] = ["issues", "forms", "reviews", "rfis"];
const ID_RE = /^[A-Za-z0-9_-]{20,64}$/;
const MAX_UNZIPPED = 80 * 1024 * 1024;

export interface ShareEnv {
  allowedDomains: string[] | null; // null = not configured
  production: boolean;
}

// Bailey Partnership's two email domains. SHARE_ALLOWED_EMAIL_DOMAINS
// (comma-separated) replaces this list when set.
export const DEFAULT_ALLOWED_DOMAINS = ["bailey-p.net", "baileyp.co.uk"];

export function parseDomains(raw: string | undefined): string[] | null {
  const list = (raw ?? "")
    .split(/[,\s;]+/)
    .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
  return list.length ? list : null;
}

export function readShareEnv(): ShareEnv {
  return {
    allowedDomains: parseDomains(process.env.SHARE_ALLOWED_EMAIL_DOMAINS) ?? DEFAULT_ALLOWED_DOMAINS,
    production: process.env.NODE_ENV === "production",
  };
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

type Who = { userId: string; email: string };

export async function verifyUser(
  authorization: string | null,
  env: ShareEnv,
  fetchImpl: typeof fetch = fetch,
): Promise<Who | Response> {
  if (!authorization?.startsWith("Bearer ")) return json(401, { error: "Sign in to share." });
  if (env.production && !env.allowedDomains) {
    return json(503, { error: "Sharing isn't configured: set SHARE_ALLOWED_EMAIL_DOMAINS on the server." });
  }
  const res = await fetchImpl(`${APS_BASE_URL}/userprofile/v1/users/@me`, { headers: { Authorization: authorization } });
  if (!res.ok) return json(401, { error: "Your Autodesk session has expired. Sign in again." });
  const p = (await res.json()) as { userId?: string; emailId?: string };
  const userId = p.userId ?? "";
  const email = (p.emailId ?? "").toLowerCase();
  if (!/^[A-Za-z0-9]+$/.test(userId)) return json(401, { error: "Could not identify your Autodesk account." });
  if (env.allowedDomains && !env.allowedDomains.some((d) => email.endsWith(`@${d}`))) {
    return json(403, {
      error: `Shared links can only be created by ${env.allowedDomains.map((d) => `@${d}`).join(" or ")} accounts. You're signed in to Autodesk as ${email || "an account with no email"}.`,
    });
  }
  return { userId, email };
}

export async function publish(req: Request, store: SnapshotStore, env: ShareEnv, fetchImpl?: typeof fetch): Promise<Response> {
  const who = await verifyUser(req.headers.get("authorization"), env, fetchImpl);
  if (who instanceof Response) return who;
  const gz = new Uint8Array(await req.arrayBuffer());
  if (gz.byteLength > MAX_SNAPSHOT_BYTES) return json(413, { error: "Snapshot too large. Select fewer projects or filter it down." });
  let body: { kind?: string; title?: string; redacted?: boolean; expiresInDays?: number; itemCount?: number; data?: unknown };
  try {
    body = JSON.parse(gunzipSync(gz, { maxOutputLength: MAX_UNZIPPED }).toString("utf8"));
  } catch {
    return json(400, { error: "Snapshot could not be read." });
  }
  if (!KINDS.includes(body.kind as SnapshotKind) || !body.data || typeof body.data !== "object") {
    return json(400, { error: "Unknown snapshot type." });
  }
  const days = (EXPIRY_DAYS as readonly number[]).includes(body.expiresInDays ?? 0) ? (body.expiresInDays as number) : 30;
  const now = new Date();
  const meta: SnapshotMeta = {
    id: randomBytes(18).toString("base64url"),
    kind: body.kind as SnapshotKind,
    title: String(body.title ?? "").slice(0, 120) || "Shared dashboard",
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + days * 86_400_000).toISOString(),
    redacted: body.redacted !== false,
    itemCount: Number(body.itemCount) || 0,
  };
  const snap: SharedSnapshot = { version: 2, ...meta, data: body.data };
  await store.putSnapshot(meta.id, gzipSync(JSON.stringify(snap)));
  await store.putMeta(who.userId, meta);
  return json(201, meta);
}

export async function fetchShared(id: string, store: SnapshotStore, now = new Date()): Promise<Response> {
  if (!ID_RE.test(id)) return json(404, { error: "Link not found." });
  const gz = await store.getSnapshot(id);
  if (!gz) return json(404, { error: "This link doesn't exist or has been removed." });
  const snap = JSON.parse(gunzipSync(gz, { maxOutputLength: MAX_UNZIPPED }).toString("utf8")) as SharedSnapshot;
  if (snap.expiresAt < now.toISOString()) return json(410, { error: "This link has expired." });
  return new Response(new Uint8Array(gz), {
    status: 200,
    headers: { "Content-Type": "application/gzip", "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" },
  });
}

export async function listMine(req: Request, store: SnapshotStore, env: ShareEnv, fetchImpl?: typeof fetch): Promise<Response> {
  const who = await verifyUser(req.headers.get("authorization"), env, fetchImpl);
  if (who instanceof Response) return who;
  const items = await store.listMeta(who.userId);
  return json(200, items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
}

export async function removeShared(req: Request, id: string, store: SnapshotStore, env: ShareEnv, fetchImpl?: typeof fetch): Promise<Response> {
  const who = await verifyUser(req.headers.get("authorization"), env, fetchImpl);
  if (who instanceof Response) return who;
  if (!ID_RE.test(id)) return json(404, { error: "Link not found." });
  if ((await store.ownerOf(id)) !== who.userId) return json(404, { error: "Link not found." });
  await store.remove(who.userId, id);
  return new Response(null, { status: 204 });
}

export function notConfigured(): Response {
  return json(503, { error: "Sharing isn't configured: connect a Vercel Blob store (BLOB_READ_WRITE_TOKEN)." });
}
