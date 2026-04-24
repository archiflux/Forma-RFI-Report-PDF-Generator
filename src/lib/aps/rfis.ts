import type { ApsClient } from "./client";
import { normaliseProjectIdForRfi } from "./projects";
import {
  ApsError,
  type CustomAttributeDef,
  type CustomAttributeType,
  type Rfi,
  type RfiScrapeProgress,
  type RfiSearchRequest,
  type RfiSearchResponse,
} from "./types";

const DEFAULT_PAGE_SIZE = 200;
const MAX_TOTAL = 5000;

export async function listCustomAttributes(
  client: ApsClient,
  projectId: string,
): Promise<CustomAttributeDef[]> {
  const p = normaliseProjectIdForRfi(projectId);
  try {
    const res = await client.request<{ results?: CustomAttributeDef[] }>({
      path: `/construction/rfis/v3/projects/${encodeURIComponent(p)}/attributes`,
    });
    return res.results ?? [];
  } catch (e) {
    // The /attributes endpoint requires "Manage Custom Attributes" project
    // permission (admin-ish). Non-admins get 403 here even when they can
    // read RFIs fine via /search:rfis. We fall back to an empty list and
    // let the caller infer minimal defs from the RFI payloads themselves.
    if (e instanceof ApsError && (e.status === 401 || e.status === 403)) {
      return [];
    }
    throw e;
  }
}

// Derive best-effort CustomAttributeDef[] from the custom-attribute values
// that appear on the RFIs the user CAN read. Produces id-only defs with a
// guessed dataType — good enough to surface columns in the grid and basic
// filter operators in the builder even when /attributes is forbidden.
export function inferCustomAttributesFromRfis(rfis: Rfi[]): CustomAttributeDef[] {
  const out = new Map<string, CustomAttributeDef>();
  for (const r of rfis) {
    for (const [id, raw] of Object.entries(r.customAttributes)) {
      if (out.has(id)) continue;
      out.set(id, { id, name: id, dataType: guessDataType(raw), inferred: true });
    }
  }
  return [...out.values()];
}

function guessDataType(raw: unknown): CustomAttributeType {
  if (typeof raw === "number") return "numeric";
  if (Array.isArray(raw)) return "multiChoice";
  // APS returns single-choice as either an id string or { id, label } object.
  if (raw && typeof raw === "object") return "singleChoice";
  return "text";
}

// Merge fetched + inferred defs. Fetched definitions always win — they
// carry real names and resolved choice values. Inferred defs fill in for
// any attribute IDs present on the RFIs but not in the fetched list.
export function mergeCustomAttributes(
  fetched: CustomAttributeDef[],
  rfis: Rfi[],
): CustomAttributeDef[] {
  if (fetched.length > 0) {
    // Even if we have fetched defs, an RFI might reference an attribute ID
    // the /attributes response didn't include (e.g. a recently-deleted
    // definition that still appears on historical RFIs). Fill those in too.
    const map = new Map<string, CustomAttributeDef>();
    for (const a of fetched) map.set(a.id, a);
    for (const a of inferCustomAttributesFromRfis(rfis)) {
      if (!map.has(a.id)) map.set(a.id, a);
    }
    return [...map.values()];
  }
  return inferCustomAttributesFromRfis(rfis);
}

export async function searchRfisPage(
  client: ApsClient,
  projectId: string,
  request: RfiSearchRequest = {},
): Promise<RfiSearchResponse> {
  const p = normaliseProjectIdForRfi(projectId);
  return client.request<RfiSearchResponse>({
    method: "POST",
    path: `/construction/rfis/v3/projects/${encodeURIComponent(p)}/search:rfis`,
    body: {
      limit: request.limit ?? DEFAULT_PAGE_SIZE,
      offset: request.offset ?? 0,
      ...(request.filter ? { filter: request.filter } : {}),
      ...(request.sort ? { sort: request.sort } : {}),
    },
  });
}

// Walk every page of search:rfis until exhausted or MAX_TOTAL hit.
// onProgress lets the UI render a progress bar without waiting for the full set.
export async function scrapeAllRfis(
  client: ApsClient,
  projectId: string,
  filter?: RfiSearchRequest["filter"],
  sort?: RfiSearchRequest["sort"],
  onProgress?: (p: RfiScrapeProgress) => void,
  signal?: AbortSignal,
): Promise<Rfi[]> {
  const limit = DEFAULT_PAGE_SIZE;
  let offset = 0;
  const out: Rfi[] = [];

  for (;;) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const page = await searchRfisPage(client, projectId, { limit, offset, filter, sort });
    out.push(...page.results);
    onProgress?.({ loaded: out.length, total: page.pagination.totalResults });
    if (page.results.length < limit) break;
    offset += limit;
    if (out.length >= MAX_TOTAL) break;
  }
  return out;
}
