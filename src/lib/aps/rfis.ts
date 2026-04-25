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
    for (const [id, values] of Object.entries(ca)) {
      if (out.has(id)) continue;
      const arr = Array.isArray(values) ? values : [values];
      out.set(id, { id, name: id, dataType: guessDataType(arr), inferred: true });
    }
  }
  return [...out.values()];
}

// `values` in our normalised shape is always an array. Guess the dataType
// from the cardinality + element type of a sample.
//   length > 1                        → multiChoice
//   length 1 + number                 → numeric
//   length 1 + UUID-shaped string     → singleChoice
//   length 1 + free string / object   → text (safe default — display still works)
const UUID_RE = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

function guessDataType(values: unknown[]): CustomAttributeType {
  if (!Array.isArray(values) || values.length === 0) return "text";
  if (values.length > 1) return "multiChoice";
  const first = values[0];
  if (typeof first === "number") return "numeric";
  if (typeof first === "string" && UUID_RE.test(first)) return "singleChoice";
  if (first && typeof first === "object" && "id" in (first as object)) return "singleChoice";
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

// APS v3 ships custom attributes on an RFI as an array of objects:
//
//   "customAttributes": [
//     { "id": "<attrId>", "values": ["text or choice-id or number"] },
//     ...
//   ]
//
// `values` is always an array — text/numeric/single-choice carry one element,
// multi-choice carry many. We collapse every observed shape (array, legacy
// record, null, junk) to a single Record<attrId, unknown[]> so display and
// filter code never has to branch on scalar vs array. APS has occasionally
// also used `attributeDefinitionId` instead of `id` and `value` instead of
// `values`, so we accept both spellings defensively.
export function normalizeCustomAttributes(
  raw: RawRfiCustomAttributes | unknown,
): Record<string, unknown[]> {
  if (raw === null || raw === undefined) return {};

  if (Array.isArray(raw)) {
    const out: Record<string, unknown[]> = {};
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const it = item as RawRfiCustomAttr;
      const id = it.id ?? it.attributeDefinitionId;
      if (typeof id !== "string" || !id) continue;
      out[id] = toValuesArray(it.values ?? it.value);
    }
    return out;
  }

  // Legacy / fallback: a plain record. Wrap every value as a single-element
  // array so consumers see a uniform shape.
  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const out: Record<string, unknown[]> = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = toValuesArray(v);
    }
    return out;
  }

  return {};
}

function toValuesArray(v: unknown): unknown[] {
  if (v === null || v === undefined) return [];
  if (Array.isArray(v)) return v.filter((x) => x !== null && x !== undefined);
  return [v];
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

// Fetch a single RFI's full detail. The search:rfis endpoint sometimes
// returns a slim view of each RFI (no customAttributes); GET /rfis/:id
// returns the full payload, which we then run through the same normaliser
// as search results so downstream code sees one shape.
export async function getRfiById(
  client: ApsClient,
  projectId: string,
  rfiId: string,
): Promise<Rfi> {
  const p = normaliseProjectIdForRfi(projectId);
  const raw = await client.request<unknown>({
    path: `/construction/rfis/v3/projects/${encodeURIComponent(p)}/rfis/${encodeURIComponent(rfiId)}`,
  });
  return normalizeRfi(raw);
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

const HYDRATE_CONCURRENCY = 8;

export interface HydrationProgress {
  hydrated: number;
  total: number;
}

// Some APS configurations return RFIs from /search:rfis with no customAttributes
// — the schema is right but the field is absent or empty even when values exist.
// Hydrate by fetching each RFI's full detail individually with bounded
// concurrency. Replaces every input RFI with its full-detail counterpart in
// place, preserving order.
export async function hydrateRfis(
  client: ApsClient,
  projectId: string,
  rfis: Rfi[],
  onProgress?: (p: HydrationProgress) => void,
  signal?: AbortSignal,
): Promise<Rfi[]> {
  const total = rfis.length;
  if (total === 0) return rfis;

  const out: Rfi[] = new Array<Rfi>(total);
  let cursor = 0;
  let done = 0;

  async function worker() {
    for (;;) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const i = cursor++;
      if (i >= total) return;
      const original = rfis[i];
      if (!original) continue;
      try {
        out[i] = await getRfiById(client, projectId, original.id);
      } catch {
        // If a single RFI fails to hydrate (deleted, permissions on this
        // particular item, transient), keep the slim version we already had
        // rather than losing the whole batch.
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

// True when at least one RFI in the batch carries customAttribute values —
// used by the UI to decide whether hydration would actually add anything,
// since some projects genuinely have no custom fields.
export function rfisHaveCustomAttributes(rfis: Rfi[]): boolean {
  for (const r of rfis) {
    const ca = r.customAttributes;
    if (ca && typeof ca === "object" && Object.keys(ca).length > 0) return true;
  }
  return false;
}
