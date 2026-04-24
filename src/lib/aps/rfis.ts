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
    const ca = r.customAttributes;
    // Defensive: should always be an object after normalizeRfi, but guard
    // against a stale cache or a future shape change anyway.
    if (!ca || typeof ca !== "object") continue;
    for (const [id, raw] of Object.entries(ca)) {
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

interface RawRfiParty {
  id?: string;
  userId?: string;
  autodeskId?: string;
  name?: string;
  displayName?: string;
  email?: string;
}

interface RawRfiCustomAttr {
  attributeDefinitionId?: string;
  id?: string;
  value?: unknown;
  values?: unknown;
}

type RawRfiCustomAttributes =
  | null
  | undefined
  | Record<string, unknown>
  | RawRfiCustomAttr[];

interface RawRfi {
  id?: string;
  number?: string;
  title?: string;
  status?: string;
  statusLabel?: string;
  createdAt?: string;
  dueDate?: string;
  assignee?: RawRfiParty | null;
  manager?: RawRfiParty | null;
  assignedTo?: RawRfiParty | null;
  question?: string;
  officialResponse?: string;
  customAttributes?: RawRfiCustomAttributes;
  attachmentCount?: number;
  attachments?: unknown[];
}

interface RawRfiSearchResponse {
  results?: RawRfi[];
  pagination?: { limit?: number; offset?: number; totalResults?: number };
}

// APS has shipped at least two shapes for `customAttributes` on an RFI:
//   object: { "<attrId>": <value> }
//   array:  [{ "attributeDefinitionId": "<attrId>", "value": <value> }, ...]
// and at times also null/omitted. Collapse every case to a plain record
// so downstream code (filter/sort/group/inference) has a single shape.
export function normalizeCustomAttributes(
  raw: RawRfiCustomAttributes | unknown,
): Record<string, unknown> {
  if (raw === null || raw === undefined) return {};
  if (Array.isArray(raw)) {
    const out: Record<string, unknown> = {};
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const it = item as RawRfiCustomAttr;
      const id = it.attributeDefinitionId ?? it.id;
      if (typeof id !== "string" || !id) continue;
      out[id] = it.value ?? it.values ?? null;
    }
    return out;
  }
  if (typeof raw === "object") return raw as Record<string, unknown>;
  return {};
}

function normalizeParty(
  raw: RawRfiParty | null | undefined,
): { id: string; name: string } | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const id = raw.id ?? raw.userId ?? raw.autodeskId;
  const name = raw.name ?? raw.displayName ?? raw.email;
  if (!id && !name) return undefined;
  return { id: id ?? "", name: name ?? id ?? "" };
}

export function normalizeRfi(raw: unknown): Rfi {
  const r = (raw && typeof raw === "object" ? (raw as RawRfi) : {}) as RawRfi;
  const attachmentCount =
    typeof r.attachmentCount === "number"
      ? r.attachmentCount
      : Array.isArray(r.attachments)
        ? r.attachments.length
        : 0;
  return {
    id: r.id ?? "",
    number: r.number ?? "",
    title: r.title ?? "",
    status: r.status ?? "",
    statusLabel: r.statusLabel,
    createdAt: r.createdAt ?? "",
    dueDate: r.dueDate,
    assignee: normalizeParty(r.assignee ?? r.assignedTo),
    manager: normalizeParty(r.manager),
    question: r.question,
    officialResponse: r.officialResponse,
    customAttributes: normalizeCustomAttributes(r.customAttributes),
    attachmentCount,
  };
}

export async function searchRfisPage(
  client: ApsClient,
  projectId: string,
  request: RfiSearchRequest = {},
): Promise<RfiSearchResponse> {
  const p = normaliseProjectIdForRfi(projectId);
  const raw = await client.request<RawRfiSearchResponse>({
    method: "POST",
    path: `/construction/rfis/v3/projects/${encodeURIComponent(p)}/search:rfis`,
    body: {
      limit: request.limit ?? DEFAULT_PAGE_SIZE,
      offset: request.offset ?? 0,
      ...(request.filter ? { filter: request.filter } : {}),
      ...(request.sort ? { sort: request.sort } : {}),
    },
  });
  return {
    results: (raw.results ?? []).map(normalizeRfi),
    pagination: {
      limit: raw.pagination?.limit ?? (request.limit ?? DEFAULT_PAGE_SIZE),
      offset: raw.pagination?.offset ?? (request.offset ?? 0),
      totalResults: raw.pagination?.totalResults,
    },
  };
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
