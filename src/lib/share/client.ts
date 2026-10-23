"use client";

import type { SharedSnapshot, SnapshotKind, SnapshotMeta } from "./types";

async function gzip(text: string): Promise<Blob> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Response(stream).blob();
}

async function gunzip(blob: Blob): Promise<string> {
  return new Response(blob.stream().pipeThrough(new DecompressionStream("gzip"))).text();
}

async function errorOf(res: Response): Promise<Error> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return new Error(body?.error ?? `Request failed (${res.status})`);
}

export async function publishSnapshot(
  token: string,
  payload: { kind: SnapshotKind; title: string; redacted: boolean; expiresInDays: number; itemCount: number; data: unknown },
): Promise<SnapshotMeta> {
  const res = await fetch("/api/share", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/gzip" },
    body: await gzip(JSON.stringify(payload)),
  });
  if (!res.ok) throw await errorOf(res);
  return (await res.json()) as SnapshotMeta;
}

export async function listMyShares(token: string): Promise<SnapshotMeta[]> {
  const res = await fetch("/api/share", { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw await errorOf(res);
  return (await res.json()) as SnapshotMeta[];
}

export async function deleteShare(token: string, id: string): Promise<void> {
  const res = await fetch(`/api/share/${encodeURIComponent(id)}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok && res.status !== 404) throw await errorOf(res);
}

export async function loadShared(id: string): Promise<SharedSnapshot> {
  const res = await fetch(`/api/share/${encodeURIComponent(id)}`);
  if (!res.ok) throw await errorOf(res);
  return JSON.parse(await gunzip(await res.blob())) as SharedSnapshot;
}

export function shareUrl(id: string): string {
  return `${window.location.origin}/view?s=${encodeURIComponent(id)}`;
}
