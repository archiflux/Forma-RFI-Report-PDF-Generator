// Issues API client. Issues are structurally identical to RFIs for our
// reporting purposes (id, title, status, dueDate, assignees, customAttributes,
// attachments), so we reuse the Rfi type as the canonical "item" shape.
//
// Endpoints (per the official ACC Issues Postman collection):
//   GET  /construction/issues/v1/projects/:p/issues                → list
//   GET  /construction/issues/v1/projects/:p/issues/:id            → single
//   GET  /construction/issues/v1/projects/:p/issue-attribute-definitions
//   GET  /construction/issues/v1/projects/:p/issue-types
//
// Issue customAttributes use { attributeDefinitionId, value } per entry —
// our normalizeRfi already accepts that aliasing.

import type { ApsClient } from "./client";
import { normaliseProjectIdForRfi } from "./projects";
import { normalizeRfi, parseAttributeDefs, type RawAttrDef } from "./rfis";
import { ApsError, type CustomAttributeDef, type Rfi, type RfiScrapeProgress } from "./types";

const DEFAULT_PAGE_SIZE = 100;
const MAX_TOTAL = 5000;
const HYDRATE_CONCURRENCY = 8;

export interface IssueSearchFilter {
  status?: string[];
  assignee?: string[];
  dueDate?: { gte?: string; lte?: string };
  createdAt?: { gte?: string; lte?: string };
}

export interface IssueSearchRequest {
  filter?: IssueSearchFilter;
  limit?: number;
  offset?: number;
}

interface RawIssueListResponse {
  results?: unknown[];
  pagination?: { limit?: number; offset?: number; totalResults?: number };
}

export async function listIssueCustomAttributes(
  client: ApsClient,
  projectId: string,
): Promise<CustomAttributeDef[]> {
  const p = normaliseProjectIdForRfi(projectId);
  try {
    const res = await client.request<{ results?: RawAttrDef[] }>({
      path: `/construction/issues/v1/projects/${encodeURIComponent(p)}/issue-attribute-definitions`,
    });
    return parseAttributeDefs(res.results);
  } catch (e) {
    // Schema endpoint can 401/403 even for project admins on some tenants.
    // Fall back to inferring from per-issue payloads in useIssuesData.
    if (e instanceof ApsError && (e.status === 401 || e.status === 403)) {
      return [];
    }
    throw e;
  }
}

export async function searchIssuesPage(
  client: ApsClient,
  projectId: string,
  request: IssueSearchRequest = {},
): Promise<{ results: Rfi[]; pagination: { limit: number; offset: number; totalResults?: number } }> {
  const p = normaliseProjectIdForRfi(projectId);
  const limit = request.limit ?? DEFAULT_PAGE_SIZE;
  const offset = request.offset ?? 0;
  const query: Record<string, string | number | undefined> = { limit, offset };
  // APS Issues v1 uses `filter[<field>]=<value>` query-string syntax. We
  // expose only the basics here — the builder does its full filtering
  // client-side against the in-memory dataset, so server-side filters are
  // optional optimisations.
  if (request.filter?.status?.length) {
    query["filter[status]"] = request.filter.status.join(",");
  }
  if (request.filter?.dueDate?.gte) {
    query["filter[due_date_min]"] = request.filter.dueDate.gte;
  }
  if (request.filter?.dueDate?.lte) {
    query["filter[due_date_max]"] = request.filter.dueDate.lte;
  }
  const raw = await client.request<RawIssueListResponse>({
    path: `/construction/issues/v1/projects/${encodeURIComponent(p)}/issues`,
    query,
  });
  return {
    results: (raw.results ?? []).map(normalizeRfi),
    pagination: {
      limit: raw.pagination?.limit ?? limit,
      offset: raw.pagination?.offset ?? offset,
      totalResults: raw.pagination?.totalResults,
    },
  };
}

// Walk every page of /issues until exhausted or MAX_TOTAL hit.
export async function scrapeAllIssues(
  client: ApsClient,
  projectId: string,
  filter?: IssueSearchFilter,
  onProgress?: (p: RfiScrapeProgress) => void,
  signal?: AbortSignal,
): Promise<Rfi[]> {
  const limit = DEFAULT_PAGE_SIZE;
  let offset = 0;
  const out: Rfi[] = [];
  for (;;) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const page = await searchIssuesPage(client, projectId, { limit, offset, filter });
    out.push(...page.results);
    onProgress?.({ loaded: out.length, total: page.pagination.totalResults });
    if (page.results.length < limit) break;
    offset += limit;
    if (out.length >= MAX_TOTAL) break;
  }
  return out;
}

export async function getIssueById(
  client: ApsClient,
  projectId: string,
  issueId: string,
): Promise<Rfi> {
  const p = normaliseProjectIdForRfi(projectId);
  const raw = await client.request<unknown>({
    path: `/construction/issues/v1/projects/${encodeURIComponent(p)}/issues/${encodeURIComponent(issueId)}`,
  });
  return normalizeRfi(raw);
}

export interface IssueHydrationProgress {
  hydrated: number;
  total: number;
}

// Hydrate slim issue records by fetching full detail for each. Mirrors the
// RFI hydrateRfis pattern — bounded concurrency, per-item failure isolation.
export async function hydrateIssues(
  client: ApsClient,
  projectId: string,
  issues: Rfi[],
  onProgress?: (p: IssueHydrationProgress) => void,
  signal?: AbortSignal,
): Promise<Rfi[]> {
  const total = issues.length;
  if (total === 0) return issues;
  const out: Rfi[] = new Array<Rfi>(total);
  let cursor = 0;
  let done = 0;
  async function worker() {
    for (;;) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const i = cursor++;
      if (i >= total) return;
      const original = issues[i];
      if (!original) continue;
      try {
        out[i] = await getIssueById(client, projectId, original.id);
      } catch {
        out[i] = original;
      }
      done++;
      onProgress?.({ hydrated: done, total });
    }
  }
  const workers = Array.from(
    { length: Math.min(HYDRATE_CONCURRENCY, total) },
    () => worker(),
  );
  await Promise.all(workers);
  return out;
}
