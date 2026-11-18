// Reads every page of an APS list endpoint as quickly as the rate limits
// allow:
//   - asks for big pages (fewer round trips), dropping back to the
//     endpoint's documented size if Autodesk rejects the bigger one (400);
//   - once the first page says how many results there are, requests all the
//     remaining pages at once (the ApsClient still caps requests in flight
//     and backs off on 429), instead of one after another.
// Endpoints that don't report a total are read page by page.

import type { ApsClient } from "./client";
import { ApsError } from "./types";

export interface PagedOptions {
  // Page size to try first, and the safe size to fall back to.
  page: number;
  fallbackPage?: number;
  max: number;
  query?: Record<string, string | number>;
  signal?: AbortSignal;
}

type PageBody = {
  results?: unknown[];
  data?: unknown[];
  pagination?: { totalResults?: number; total?: number };
  totalResults?: number;
};

const itemsOf = (b: PageBody) => b.results ?? b.data ?? [];
const totalOf = (b: PageBody): number | undefined => {
  const t = b.pagination?.totalResults ?? b.pagination?.total ?? b.totalResults;
  return typeof t === "number" && Number.isFinite(t) ? t : undefined;
};

// Remembers, per endpoint, a big page size Autodesk turned down.
const rejected = new Set<string>();
const endpointKey = (path: string) => path.replace(/\/projects\/[^/]+/, "/projects/:p");

export async function scrapePaged(client: ApsClient, path: string, o: PagedOptions): Promise<unknown[]> {
  const key = endpointKey(path);
  let size = o.fallbackPage && rejected.has(key) ? o.fallbackPage : o.page;
  const get = (limit: number, offset: number) =>
    client.request<PageBody>({ path, query: { ...o.query, limit, offset }, ...(o.signal ? { signal: o.signal } : {}) });

  let first: PageBody;
  try {
    first = await get(size, 0);
  } catch (e) {
    if (!(e instanceof ApsError && e.status === 400 && o.fallbackPage && size > o.fallbackPage)) throw e;
    rejected.add(key);
    size = o.fallbackPage;
    first = await get(size, 0);
  }
  const out = [...itemsOf(first)];
  if (out.length < size) return out;

  const total = totalOf(first);
  if (total !== undefined) {
    const offsets: number[] = [];
    for (let off = size; off < Math.min(total, o.max); off += size) offsets.push(off);
    const pages = await Promise.all(offsets.map((off) => get(size, off)));
    for (const p of pages) out.push(...itemsOf(p));
    return out.slice(0, o.max);
  }

  // No total reported: one page after another.
  for (let off = size; out.length < o.max; off += size) {
    if (o.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const page = itemsOf(await get(size, off));
    out.push(...page);
    if (page.length < size) break;
  }
  return out.slice(0, o.max);
}
