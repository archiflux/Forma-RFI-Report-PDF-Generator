import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import { fetchShared, listMine, publish, removeShared, type ShareEnv } from "@/lib/share/handlers";
import { FileStore } from "@/lib/share/store";
import type { SharedSnapshot, SnapshotMeta } from "@/lib/share/types";

const env: ShareEnv = { allowedDomains: ["bailey-p.net"], production: true };

// Fake APS /userprofile: token "alice" and "bob" are Bailey users, "eve" is not.
const fakeFetch = (async (_url: string, init?: RequestInit) => {
  const auth = new Headers(init?.headers).get("authorization") ?? "";
  const who: Record<string, { userId: string; emailId: string }> = {
    "Bearer alice": { userId: "ALICE1", emailId: "alice@bailey-p.net" },
    "Bearer bob": { userId: "BOB1", emailId: "bob@bailey-p.net" },
    "Bearer eve": { userId: "EVE1", emailId: "eve@example.com" },
  };
  const p = who[auth];
  return p ? new Response(JSON.stringify(p)) : new Response("{}", { status: 401 });
}) as typeof fetch;

function req(method: string, token?: string, body?: unknown): Request {
  return new Request("http://x/api/share", {
    method,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    ...(body ? { body: gzipSync(JSON.stringify(body)) } : {}),
  });
}

const payload = { kind: "issues", title: "Riverside", redacted: true, expiresInDays: 7, itemCount: 2, data: { issues: [] } };

let dir: string;
let store: FileStore;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "share-"));
  store = new FileStore(dir);
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("hosted snapshots", () => {
  it("rejects unsigned, unknown-domain and unconfigured publishers", async () => {
    expect((await publish(req("POST", undefined, payload), store, env, fakeFetch)).status).toBe(401);
    expect((await publish(req("POST", "eve", payload), store, env, fakeFetch)).status).toBe(403);
    expect((await publish(req("POST", "nobody", payload), store, env, fakeFetch)).status).toBe(401);
    const unconfigured: ShareEnv = { allowedDomains: null, production: true };
    expect((await publish(req("POST", "alice", payload), store, unconfigured, fakeFetch)).status).toBe(503);
  });

  it("rejects unknown kinds", async () => {
    expect((await publish(req("POST", "alice", { ...payload, kind: "secrets" }), store, env, fakeFetch)).status).toBe(400);
  });

  it("publishes, serves until expiry, and lists for the owner only", async () => {
    const res = await publish(req("POST", "alice", payload), store, env, fakeFetch);
    expect(res.status).toBe(201);
    const meta = (await res.json()) as SnapshotMeta;
    expect(meta).toMatchObject({ kind: "issues", title: "Riverside", redacted: true, itemCount: 2 });
    expect(meta.id).toMatch(/^[A-Za-z0-9_-]{24}$/);

    const got = await fetchShared(meta.id, store);
    expect(got.status).toBe(200);
    const snap = JSON.parse(gunzipSync(Buffer.from(await got.arrayBuffer())).toString()) as SharedSnapshot;
    expect(snap).toMatchObject({ version: 2, id: meta.id, data: { issues: [] } });

    expect((await fetchShared(meta.id, store, new Date(Date.now() + 8 * 86_400_000))).status).toBe(410);
    expect((await fetchShared("../../etc/passwd", store)).status).toBe(404);

    const aliceList = (await (await listMine(req("GET", "alice"), store, env, fakeFetch)).json()) as SnapshotMeta[];
    expect(aliceList.map((m) => m.id)).toEqual([meta.id]);
    expect(await (await listMine(req("GET", "bob"), store, env, fakeFetch)).json()).toEqual([]);
  });

  it("only the owner can delete", async () => {
    const meta = (await (await publish(req("POST", "alice", payload), store, env, fakeFetch)).json()) as SnapshotMeta;
    expect((await removeShared(req("DELETE", "bob"), meta.id, store, env, fakeFetch)).status).toBe(404);
    expect((await fetchShared(meta.id, store)).status).toBe(200);
    expect((await removeShared(req("DELETE", "alice"), meta.id, store, env, fakeFetch)).status).toBe(204);
    expect((await fetchShared(meta.id, store)).status).toBe(404);
  });

  it("defaults unexpected expiry values to 30 days", async () => {
    const meta = (await (await publish(req("POST", "alice", { ...payload, expiresInDays: 9999 }), store, env, fakeFetch)).json()) as SnapshotMeta;
    const days = (Date.parse(meta.expiresAt) - Date.parse(meta.createdAt)) / 86_400_000;
    expect(Math.round(days)).toBe(30);
  });
});
