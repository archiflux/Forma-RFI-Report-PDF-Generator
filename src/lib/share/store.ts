// Server-only snapshot storage. Uses Vercel Blob (private access) when
// BLOB_READ_WRITE_TOKEN is set, otherwise a local folder for development.
// Layout:
//   snap/<id>.json.gz        gzipped SharedSnapshot
//   meta/<ownerId>/<id>.json SnapshotMeta, for the owner's list

import { promises as fs } from "node:fs";
import path from "node:path";
import { del, get, list, put } from "@vercel/blob";
import type { SnapshotMeta } from "./types";

export interface SnapshotStore {
  putSnapshot(id: string, gz: Uint8Array): Promise<void>;
  getSnapshot(id: string): Promise<Uint8Array | null>;
  putMeta(ownerId: string, meta: SnapshotMeta): Promise<void>;
  listMeta(ownerId: string): Promise<SnapshotMeta[]>;
  remove(ownerId: string, id: string): Promise<void>;
  // Owner lookup for delete without trusting the client.
  ownerOf(id: string): Promise<string | null>;
}

const snapPath = (id: string) => `snap/${id}.json.gz`;
const metaPath = (owner: string, id: string) => `meta/${owner}/${id}.json`;
const ownerPath = (id: string) => `owner/${id}.txt`;

async function readStream(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

class BlobStore implements SnapshotStore {
  private access = "private" as const;
  private async read(pathname: string): Promise<Uint8Array | null> {
    const r = await get(pathname, { access: this.access, useCache: false }).catch(() => null);
    return r && r.statusCode === 200 ? readStream(r.stream) : null;
  }
  private async write(pathname: string, body: Uint8Array | string, contentType: string) {
    await put(pathname, Buffer.from(body), { access: this.access, addRandomSuffix: false, allowOverwrite: true, contentType });
  }
  async putSnapshot(id: string, gz: Uint8Array) {
    await this.write(snapPath(id), gz, "application/gzip");
  }
  getSnapshot(id: string) {
    return this.read(snapPath(id));
  }
  async putMeta(owner: string, meta: SnapshotMeta) {
    await this.write(metaPath(owner, meta.id), JSON.stringify(meta), "application/json");
    await this.write(ownerPath(meta.id), owner, "text/plain");
  }
  async listMeta(owner: string) {
    const { blobs } = await list({ prefix: `meta/${owner}/` });
    const out: SnapshotMeta[] = [];
    for (const b of blobs) {
      const raw = await this.read(b.pathname);
      if (raw) out.push(JSON.parse(Buffer.from(raw).toString("utf8")) as SnapshotMeta);
    }
    return out;
  }
  async remove(owner: string, id: string) {
    await del([snapPath(id), metaPath(owner, id), ownerPath(id)]);
  }
  async ownerOf(id: string) {
    const raw = await this.read(ownerPath(id));
    return raw ? Buffer.from(raw).toString("utf8") : null;
  }
}

class FileStore implements SnapshotStore {
  constructor(private root: string) {}
  private file(p: string) {
    return path.join(this.root, p);
  }
  private async write(p: string, body: Uint8Array | string) {
    await fs.mkdir(path.dirname(this.file(p)), { recursive: true });
    await fs.writeFile(this.file(p), body);
  }
  private async read(p: string): Promise<Uint8Array | null> {
    try {
      return new Uint8Array(await fs.readFile(this.file(p)));
    } catch {
      return null;
    }
  }
  putSnapshot(id: string, gz: Uint8Array) {
    return this.write(snapPath(id), gz);
  }
  getSnapshot(id: string) {
    return this.read(snapPath(id));
  }
  async putMeta(owner: string, meta: SnapshotMeta) {
    await this.write(metaPath(owner, meta.id), JSON.stringify(meta));
    await this.write(ownerPath(meta.id), owner);
  }
  async listMeta(owner: string) {
    const dir = this.file(`meta/${owner}`);
    const names = await fs.readdir(dir).catch(() => [] as string[]);
    const out: SnapshotMeta[] = [];
    for (const n of names) {
      const raw = await this.read(`meta/${owner}/${n}`);
      if (raw) out.push(JSON.parse(Buffer.from(raw).toString("utf8")) as SnapshotMeta);
    }
    return out;
  }
  async remove(owner: string, id: string) {
    for (const p of [snapPath(id), metaPath(owner, id), ownerPath(id)]) await fs.rm(this.file(p), { force: true });
  }
  async ownerOf(id: string) {
    const raw = await this.read(ownerPath(id));
    return raw ? Buffer.from(raw).toString("utf8") : null;
  }
}

export function getStore(): SnapshotStore | null {
  if (process.env.BLOB_READ_WRITE_TOKEN) return new BlobStore();
  // Local folder only outside production, so a misconfigured deploy fails
  // loudly instead of writing to an ephemeral disk.
  if (process.env.NODE_ENV !== "production" || process.env.SHARE_LOCAL_DIR) {
    return new FileStore(process.env.SHARE_LOCAL_DIR ?? path.join(process.cwd(), ".data", "share"));
  }
  return null;
}

export { FileStore };
