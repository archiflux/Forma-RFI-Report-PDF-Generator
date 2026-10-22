// Per-project Issues lookup tables (types, subtypes, root causes) and a raw
// issue scraper. The dashboard needs issue-specific fields (issueTypeId,
// rootCauseId, linkedDocuments, assignedToType) that the RFI-shaped
// normaliser in rfis.ts files under `extra`, so it reads the raw payload.
//
// Endpoints (all GET):
//   /construction/issues/v1/projects/:p/issues
//   /construction/issues/v1/projects/:p/issue-types?include=subtypes
//   /construction/issues/v1/projects/:p/issue-root-cause-categories?include=rootcauses

import type { ApsClient } from "./client";
import { normaliseProjectIdForRfi } from "./projects";
import { ApsError } from "./types";

const PAGE = 100;
const MAX_TOTAL = 10000;

export interface IssueLookups {
  types: Record<string, string>;
  subtypes: Record<string, string>;
  rootCauses: Record<string, string>;
}

interface RawTitled {
  id?: string;
  title?: string;
  name?: string;
}

interface RawTypeList {
  results?: Array<RawTitled & { subtypes?: RawTitled[] }>;
}

interface RawRootCauseList {
  results?: Array<RawTitled & { rootCauses?: RawTitled[] }>;
}

function base(projectId: string): string {
  return `/construction/issues/v1/projects/${encodeURIComponent(normaliseProjectIdForRfi(projectId))}`;
}

function label(t: RawTitled): string {
  return t.title ?? t.name ?? t.id ?? "";
}

// Lookups are best-effort: a 403 on either list leaves the ids unresolved
// rather than failing the whole dashboard.
async function tryGet<T>(client: ApsClient, path: string, query?: Record<string, string>): Promise<T | null> {
  try {
    return await client.request<T>({ path, query });
  } catch (e) {
    if (e instanceof ApsError && (e.status === 401 || e.status === 403 || e.status === 404)) {
      return null;
    }
    throw e;
  }
}

export async function getIssueLookups(client: ApsClient, projectId: string): Promise<IssueLookups> {
  const [types, causes] = await Promise.all([
    tryGet<RawTypeList>(client, `${base(projectId)}/issue-types`, { include: "subtypes", limit: "200" }),
    tryGet<RawRootCauseList>(client, `${base(projectId)}/issue-root-cause-categories`, {
      include: "rootcauses",
      limit: "200",
    }),
  ]);
  const out: IssueLookups = { types: {}, subtypes: {}, rootCauses: {} };
  for (const t of types?.results ?? []) {
    if (t.id) out.types[t.id] = label(t);
    for (const s of t.subtypes ?? []) if (s.id) out.subtypes[s.id] = label(s);
  }
  for (const c of causes?.results ?? []) {
    for (const r of c.rootCauses ?? []) if (r.id) out.rootCauses[r.id] = label(r);
  }
  return out;
}

export async function scrapeRawIssues(
  client: ApsClient,
  projectId: string,
  signal?: AbortSignal,
): Promise<unknown[]> {
  const out: unknown[] = [];
  let offset = 0;
  for (;;) {
    const res = await client.request<{ results?: unknown[] }>({
      path: `${base(projectId)}/issues`,
      query: { limit: PAGE, offset },
      signal,
    });
    const page = res.results ?? [];
    out.push(...page);
    if (page.length < PAGE || out.length >= MAX_TOTAL) break;
    offset += PAGE;
  }
  return out;
}

interface RawLocationNode {
  id?: string;
  parentId?: string | null;
  name?: string;
  type?: string;
}

// Location id -> breadcrumb ("Block A > Level 2"). The tree's root node is
// the project itself, so it is left out of the path. Best-effort: projects
// without a locations tree just leave ids unresolved.
export async function getLocationNames(client: ApsClient, projectId: string): Promise<Record<string, string>> {
  const p = encodeURIComponent(normaliseProjectIdForRfi(projectId));
  const nodes: RawLocationNode[] = [];
  let offset = 0;
  for (;;) {
    const res = await tryGet<{ results?: RawLocationNode[] }>(
      client,
      `/construction/locations/v2/projects/${p}/trees/default/nodes`,
      { limit: "500", offset: String(offset) },
    );
    const page = res?.results ?? [];
    nodes.push(...page);
    if (page.length < 500 || nodes.length >= 20000) break;
    offset += 500;
  }
  const byId = new Map(nodes.filter((n) => n.id).map((n) => [n.id as string, n]));
  const out: Record<string, string> = {};
  for (const n of byId.values()) {
    const parts: string[] = [];
    let cur: RawLocationNode | undefined = n;
    let guard = 0;
    while (cur && cur.parentId && guard++ < 20) {
      if (cur.name) parts.unshift(cur.name);
      cur = byId.get(cur.parentId);
    }
    if (parts.length) out[n.id as string] = parts.join(" > ");
  }
  return out;
}
