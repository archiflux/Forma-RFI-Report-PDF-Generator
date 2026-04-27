import type { ApsClient } from "./client";
import { normaliseProjectIdForRfi } from "./projects";
import {
  ApsError,
  type CustomAttributeDef,
  type CustomAttributeType,
  type ObservedCustomAttrMeta,
  type Rfi,
  type RfiAttachment,
  type RfiComment,
  type RfiParty,
  type RfiScrapeProgress,
  type RfiSearchRequest,
  type RfiSearchResponse,
} from "./types";

const DEFAULT_PAGE_SIZE = 200;
const MAX_TOTAL = 5000;

// Shape of GET /construction/rfis/v3/projects/:p/attributes per the official
// Postman collection:
//   {
//     "results": [{
//       "id": "<uuid>",
//       "name": "Discipline",
//       "type": "text",
//       "description": "...",
//       "multipleChoice": false,
//       "possibleValues": [{ "id": "<uuid>", "name": "Architecture" }]
//     }]
//   }
// Note that `type` is usually "text" even for choice fields — the actual
// dataType is inferred from `multipleChoice` + non-empty `possibleValues`.
export interface RawAttrDef {
  id?: string;
  name?: string;
  type?: string;
  description?: string;
  multipleChoice?: boolean;
  possibleValues?: Array<{ id?: string; name?: string; label?: string; value?: unknown }>;
}

export function attrDefDataType(raw: RawAttrDef): CustomAttributeType {
  const t = raw.type?.toLowerCase().replace(/[_\s-]/g, "");
  if (t === "numeric" || t === "number" || t === "integer" || t === "decimal") {
    return "numeric";
  }
  const hasChoices = Array.isArray(raw.possibleValues) && raw.possibleValues.length > 0;
  if (raw.multipleChoice === true) return "multiChoice";
  if (hasChoices) return "singleChoice";
  return "text";
}

export function attrDefChoices(
  raw: RawAttrDef,
): { id: string; label: string }[] | undefined {
  if (!Array.isArray(raw.possibleValues) || raw.possibleValues.length === 0) {
    return undefined;
  }
  const out: { id: string; label: string }[] = [];
  for (const v of raw.possibleValues) {
    const id = v?.id ?? (typeof v?.value === "string" ? v.value : undefined);
    if (typeof id !== "string" || !id) continue;
    out.push({ id, label: v.label ?? v.name ?? String(v.value ?? id) });
  }
  return out.length ? out : undefined;
}

// Shared parser: takes raw `{results: RawAttrDef[]}` from either the RFI
// /attributes endpoint or the Issues /issue-attribute-definitions endpoint
// and produces a clean CustomAttributeDef[].
export function parseAttributeDefs(results: RawAttrDef[] | undefined): CustomAttributeDef[] {
  return (results ?? []).flatMap((raw) => {
    if (typeof raw?.id !== "string" || !raw.id) return [];
    const def: CustomAttributeDef = {
      id: raw.id,
      name: raw.name ?? raw.id,
      dataType: attrDefDataType(raw),
    };
    const values = attrDefChoices(raw);
    if (values) def.values = values;
    return [def];
  });
}

export async function listCustomAttributes(
  client: ApsClient,
  projectId: string,
): Promise<CustomAttributeDef[]> {
  const p = normaliseProjectIdForRfi(projectId);
  try {
    const res = await client.request<{ results?: RawAttrDef[] }>({
      path: `/construction/rfis/v3/projects/${encodeURIComponent(p)}/attributes`,
    });
    return parseAttributeDefs(res.results);
  } catch (e) {
    // /attributes is officially gated behind data:read+data:write+data:create
    // (per the APS Postman collection). When even those scopes don't help —
    // typically because the signed-in user isn't a project admin — fall back
    // to the per-RFI metadata + inference path so the app still works.
    if (e instanceof ApsError && (e.status === 401 || e.status === 403)) {
      return [];
    }
    throw e;
  }
}

// Derive best-effort CustomAttributeDef[] from the custom-attribute values
// that appear on the RFIs the user CAN read. Aggregates per-id metadata
// (name, dataType, choices) across every observed RFI, so a single RFI that
// happened to carry `name: "Discipline"` lifts the title for that id across
// the whole project. Falls back to id-only when nothing carries metadata.
export function inferCustomAttributesFromRfis(rfis: Rfi[]): CustomAttributeDef[] {
  const out = new Map<string, CustomAttributeDef>();
  const sampleValues = new Map<string, unknown[]>();
  const aggregatedMeta = new Map<string, ObservedCustomAttrMeta>();

  for (const r of rfis) {
    const ca = r.customAttributes;
    if (ca && typeof ca === "object") {
      for (const [id, values] of Object.entries(ca)) {
        const arr = Array.isArray(values) ? values : [values];
        if (!sampleValues.has(id) && arr.length > 0) {
          sampleValues.set(id, arr);
        } else if (arr.length > 1) {
          // Prefer the longer-cardinality sample so multi-choice fields are
          // detected even if some RFIs only set a single option.
          const prev = sampleValues.get(id);
          if (!prev || arr.length > prev.length) sampleValues.set(id, arr);
        }
      }
    }
    const meta = r.customAttributesMeta;
    if (meta) {
      for (const [id, m] of Object.entries(meta)) {
        const existing = aggregatedMeta.get(id) ?? {};
        aggregatedMeta.set(id, {
          name: existing.name ?? m.name,
          dataType: existing.dataType ?? m.dataType,
          values: existing.values ?? m.values,
        });
      }
    }
  }

  // Union of every id we ever saw — either as a value or via metadata.
  const allIds = new Set<string>([...sampleValues.keys(), ...aggregatedMeta.keys()]);
  for (const id of allIds) {
    const m = aggregatedMeta.get(id);
    const sample = sampleValues.get(id) ?? [];
    out.set(id, {
      id,
      name: m?.name ?? id,
      dataType: m?.dataType ?? guessDataType(sample),
      values: m?.values,
      inferred: true,
    });
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

interface RawRfiChoice {
  id?: string;
  label?: string;
  name?: string;
  value?: unknown;
}

interface RawRfiCustomAttr {
  attributeDefinitionId?: string;
  id?: string;
  // Display-side metadata APS may attach when the schema endpoint is unavailable.
  name?: string;
  title?: string;
  displayName?: string;
  attributeName?: string;
  type?: string;
  dataType?: string;
  // The value(s) carried on this RFI for this attribute.
  value?: unknown;
  values?: unknown;
  // Choice catalogues that some APS responses bundle with each value entry,
  // letting us resolve choice ids to labels even without the schema.
  options?: RawRfiChoice[];
  choices?: RawRfiChoice[];
  possibleValues?: RawRfiChoice[];
}

type RawRfiCustomAttributes =
  | null
  | undefined
  | Record<string, unknown>
  | RawRfiCustomAttr[];

// APS RFI v3 commonly returns assignedTo as `[{ id, type }]` (an array of
// references — multiple assignees are possible). Older / sibling APIs
// occasionally return a single { id, type } object or a bare id string.
type RawAssignedToEntry = { id?: string; type?: string; userId?: string } | string | null;
type RawAssignedTo = RawAssignedToEntry | RawAssignedToEntry[] | null | undefined;

interface RawRfiAttachment {
  id?: string;
  attachmentId?: string;
  fileName?: string;
  displayName?: string;
  storageUrn?: string;
  attachmentType?: string;
  url?: string;
  permittedActions?: unknown;
}

interface RawRfiComment {
  id?: string;
  commentId?: string;
  body?: string;
  text?: string;
  createdBy?: RawRfiParty | null;
  author?: RawRfiParty | null;
  user?: RawRfiParty | null;
  createdAt?: string;
  attachments?: RawRfiAttachment[];
  attachmentType?: string;
  isOfficialResponse?: boolean;
}

// Fields we explicitly model and extract from the RFI payload. We use a
// permissive index signature so unknown/extra fields fall through into the
// catch-all `extra` bag rather than getting silently dropped.
interface RawRfi {
  id?: string;
  number?: string;
  customIdentifier?: string;
  identifier?: string;
  displayId?: string;
  rfiNumber?: string;
  title?: string;
  status?: string;
  statusLabel?: string;
  createdAt?: string;
  updatedAt?: string;
  closedAt?: string;
  respondedAt?: string;
  dueDate?: string;

  assignee?: RawRfiParty | null;
  assignedTo?: RawAssignedTo;
  manager?: RawRfiParty | null;
  managerUser?: RawRfiParty | null;
  managedBy?: RawAssignedTo;
  reviewer?: RawRfiParty | null;
  ballInCourt?: RawAssignedTo;
  ballInCourtId?: string;
  coReviewers?: RawAssignedTo;
  reviewers?: RawAssignedTo;
  distributionList?: RawAssignedTo;
  distributedTo?: RawAssignedTo;
  watchers?: RawAssignedTo;

  priority?: string;
  location?: string;
  locationId?: string;
  locationDescription?: string;
  discipline?: string;
  disciplines?: string[] | string;
  category?: string;

  question?: string;
  officialResponse?: string;
  suggestedAnswer?: string;
  rfiTypeId?: string;

  customAttributes?: RawRfiCustomAttributes;
  attachmentCount?: number;
  attachments?: RawRfiAttachment[];
  attachmentIds?: unknown[];

  [extra: string]: unknown;
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

// APS sometimes only normalises the dataType string (e.g. "TEXT", "single_choice").
// Map every spelling we've observed to our internal CustomAttributeType union.
function normalizeAttrType(raw: string | undefined): CustomAttributeType | undefined {
  if (!raw) return undefined;
  const s = raw.toLowerCase().replace(/[_\s-]/g, "");
  if (s === "text" || s === "string") return "text";
  if (s === "numeric" || s === "number" || s === "integer" || s === "decimal") return "numeric";
  if (s === "singlechoice" || s === "singlepick" || s === "select" || s === "dropdown") {
    return "singleChoice";
  }
  if (s === "multichoice" || s === "multipick" || s === "multiselect") return "multiChoice";
  return undefined;
}

function normalizeChoices(
  raw: RawRfiChoice[] | undefined,
): { id: string; label: string }[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: { id: string; label: string }[] = [];
  for (const c of raw) {
    if (!c || typeof c !== "object") continue;
    const id = c.id ?? (typeof c.value === "string" ? c.value : undefined);
    if (typeof id !== "string" || !id) continue;
    out.push({ id, label: c.label ?? c.name ?? String(c.value ?? id) });
  }
  return out.length ? out : undefined;
}

// Extract the display-side metadata APS attaches to each customAttribute entry.
// Returns undefined when nothing useful was present, so the caller can elide
// the field on the Rfi and keep cached payloads small.
export function extractCustomAttributesMeta(
  raw: RawRfiCustomAttributes | unknown,
): Record<string, ObservedCustomAttrMeta> | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: Record<string, ObservedCustomAttrMeta> = {};
  let any = false;
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const it = item as RawRfiCustomAttr;
    const id = it.id ?? it.attributeDefinitionId;
    if (typeof id !== "string" || !id) continue;
    const name = it.name ?? it.title ?? it.displayName ?? it.attributeName;
    const dataType = normalizeAttrType(it.dataType ?? it.type);
    const values = normalizeChoices(it.options ?? it.choices ?? it.possibleValues);
    if (name || dataType || values) {
      out[id] = { name, dataType, values };
      any = true;
    }
  }
  return any ? out : undefined;
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

// APS RFI v3 returns assignedTo as an array of references. Each reference
// is { id, type } with no name attached — we resolve names later via the
// project user roster. Tolerate the older single-object form, bare-id-string
// form, and a missing field.
function normalizeAssignees(raw: RawAssignedTo): RfiParty[] {
  if (raw === null || raw === undefined) return [];
  const items = Array.isArray(raw) ? raw : [raw];
  const out: RfiParty[] = [];
  for (const item of items) {
    if (item === null || item === undefined) continue;
    if (typeof item === "string") {
      if (item) out.push({ id: item, name: item });
      continue;
    }
    if (typeof item !== "object") continue;
    const id = item.id ?? item.userId;
    if (typeof id !== "string" || !id) continue;
    out.push({ id, name: id }); // name is the id until the user-roster pass resolves it
  }
  return out;
}

function normalizeAttachments(raw: RawRfiAttachment[] | undefined): RfiAttachment[] {
  if (!Array.isArray(raw)) return [];
  const out: RfiAttachment[] = [];
  for (const a of raw) {
    if (!a || typeof a !== "object") continue;
    const id = a.id ?? a.attachmentId;
    if (typeof id !== "string" || !id) continue;
    out.push({
      id,
      ...(a.fileName ? { fileName: a.fileName } : {}),
      ...(a.displayName ? { displayName: a.displayName } : {}),
      ...(a.storageUrn ? { storageUrn: a.storageUrn } : {}),
      ...(a.attachmentType ? { attachmentType: a.attachmentType } : {}),
      ...(a.url ? { url: a.url } : {}),
    });
  }
  return out;
}

// Fields we extract explicitly. Anything on the raw payload NOT in this
// list ends up in the `extra` bag so it can still appear as a column.
const EXPLICIT_FIELDS = new Set<string>([
  "id", "number", "customIdentifier", "identifier", "displayId", "rfiNumber",
  "title", "status", "statusLabel",
  "createdAt", "updatedAt", "closedAt", "respondedAt", "dueDate",
  "assignee", "assignedTo", "manager", "managerUser", "managedBy", "reviewer",
  "ballInCourt", "ballInCourtId", "coReviewers", "reviewers",
  "distributionList", "distributedTo", "watchers",
  "priority", "location", "locationId", "locationDescription",
  "discipline", "disciplines", "category",
  "question", "officialResponse", "suggestedAnswer", "rfiTypeId",
  "customAttributes", "attachments", "attachmentCount", "attachmentIds",
  "comments",
]);

function extractExtra(r: RawRfi): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(r)) {
    if (EXPLICIT_FIELDS.has(k)) continue;
    if (v === null || v === undefined) continue;
    out[k] = v;
  }
  return out;
}

export function normalizeRfi(raw: unknown): Rfi {
  const r = (raw && typeof raw === "object" ? (raw as RawRfi) : {}) as RawRfi;
  const attachments = normalizeAttachments(r.attachments);
  const attachmentCount =
    typeof r.attachmentCount === "number"
      ? r.attachmentCount
      : Array.isArray(r.attachments) && r.attachments.length > 0
        ? r.attachments.length
        : Array.isArray(r.attachmentIds)
          ? r.attachmentIds.length
          : 0;
  const meta = extractCustomAttributesMeta(r.customAttributes);

  const assignees = normalizeAssignees(r.assignedTo);
  const legacyAssignee = normalizeParty(r.assignee);
  if (legacyAssignee && !assignees.some((a) => a.id === legacyAssignee.id)) {
    assignees.unshift(legacyAssignee);
  }

  // Manager is single in the data model. Look across the various spellings
  // APS has used; first non-empty wins.
  const manager =
    normalizeParty(r.manager) ??
    normalizeParty(r.managerUser) ??
    normalizeAssignees(r.managedBy)[0] ??
    normalizeParty(r.reviewer);

  // Ball-in-court — array because APS sometimes returns multiple. If APS
  // returns it as a bare id (ballInCourtId), wrap into a single-entry array.
  const ballInCourt = normalizeAssignees(r.ballInCourt);
  if (ballInCourt.length === 0 && typeof r.ballInCourtId === "string" && r.ballInCourtId) {
    ballInCourt.push({ id: r.ballInCourtId, name: r.ballInCourtId });
  }

  const number =
    r.customIdentifier ?? r.identifier ?? r.displayId ?? r.rfiNumber ?? r.number ?? "";

  // Discipline is sometimes an array, sometimes a single string.
  const discipline = Array.isArray(r.disciplines)
    ? r.disciplines.filter((s) => typeof s === "string").join(", ")
    : (r.discipline ?? (typeof r.disciplines === "string" ? r.disciplines : undefined));

  return {
    id: r.id ?? "",
    number,
    title: r.title ?? "",
    status: r.status ?? "",
    statusLabel: r.statusLabel,
    createdAt: r.createdAt ?? "",
    updatedAt: r.updatedAt,
    closedAt: r.closedAt,
    respondedAt: r.respondedAt,
    dueDate: r.dueDate,

    assignees,
    manager,
    ballInCourt,
    coReviewers: normalizeAssignees(r.coReviewers ?? r.reviewers),
    distributionList: normalizeAssignees(r.distributionList ?? r.distributedTo),
    watchers: normalizeAssignees(r.watchers),

    priority: r.priority,
    location: r.location ?? r.locationId,
    locationDescription: r.locationDescription,
    discipline,
    category: r.category,

    question: r.question,
    officialResponse: r.officialResponse,
    suggestedAnswer: r.suggestedAnswer,
    rfiTypeId: r.rfiTypeId,

    extra: extractExtra(r),
    customAttributes: normalizeCustomAttributes(r.customAttributes),
    ...(meta ? { customAttributesMeta: meta } : {}),
    attachments,
    attachmentCount,
    comments: [],
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

// GET /construction/rfis/v3/projects/:p/rfis/:id/attachments — separate
// endpoint. Search and even GET-by-id sometimes return an empty attachments
// array on tenants where attachments live in a sibling endpoint, so we hit
// this explicitly during hydration.
export async function getRfiAttachments(
  client: ApsClient,
  projectId: string,
  rfiId: string,
): Promise<RfiAttachment[]> {
  const p = normaliseProjectIdForRfi(projectId);
  try {
    const res = await client.request<{ results?: RawRfiAttachment[] }>({
      path: `/construction/rfis/v3/projects/${encodeURIComponent(p)}/rfis/${encodeURIComponent(rfiId)}/attachments`,
    });
    return normalizeAttachments(res.results ?? []);
  } catch (e) {
    // Per-RFI permission boundary — fall back to whatever was on the RFI.
    if (e instanceof ApsError && (e.status === 401 || e.status === 403)) {
      return [];
    }
    throw e;
  }
}

// GET /construction/rfis/v3/projects/:p/rfis/:id/comments — paginated.
export async function getRfiComments(
  client: ApsClient,
  projectId: string,
  rfiId: string,
): Promise<RfiComment[]> {
  const p = normaliseProjectIdForRfi(projectId);
  try {
    const res = await client.request<{ results?: RawRfiComment[] }>({
      path: `/construction/rfis/v3/projects/${encodeURIComponent(p)}/rfis/${encodeURIComponent(rfiId)}/comments`,
      query: { limit: 200 },
    });
    return (res.results ?? []).flatMap((raw) => {
      if (!raw || typeof raw !== "object") return [];
      const id = raw.id ?? raw.commentId;
      if (typeof id !== "string" || !id) return [];
      const author = normalizeParty(raw.createdBy ?? raw.author ?? raw.user);
      const comment: RfiComment = {
        id,
        body: raw.body ?? raw.text ?? "",
        ...(author ? { author } : {}),
        ...(raw.createdAt ? { createdAt: raw.createdAt } : {}),
        attachments: normalizeAttachments(raw.attachments),
        ...(raw.attachmentType === "rfiResponse" || raw.isOfficialResponse
          ? { isOfficialResponse: true }
          : {}),
      };
      return [comment];
    });
  } catch (e) {
    if (e instanceof ApsError && (e.status === 401 || e.status === 403)) {
      return [];
    }
    throw e;
  }
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

export interface HydrateOptions {
  // Fetch the per-RFI /attachments list (and use its length for the
  // accurate count). Default true — search/get-by-id sometimes return
  // an empty attachments array even when files exist.
  attachments?: boolean;
  // Fetch /comments as well. Default false — comments add a request per
  // RFI, only needed when the user wants the Detail PDF layout.
  comments?: boolean;
}

// Some APS configurations return RFIs from /search:rfis with no customAttributes
// — the schema is right but the field is absent or empty even when values exist.
// Hydrate by fetching each RFI's full detail individually with bounded
// concurrency. Replaces every input RFI with its full-detail counterpart in
// place, preserving order. Optionally pulls attachments and comments from
// their dedicated endpoints in parallel with the main fetch.
export async function hydrateRfis(
  client: ApsClient,
  projectId: string,
  rfis: Rfi[],
  onProgress?: (p: HydrationProgress) => void,
  signal?: AbortSignal,
  options: HydrateOptions = { attachments: true, comments: false },
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
        const [detail, attachments, comments] = await Promise.all([
          getRfiById(client, projectId, original.id),
          options.attachments !== false
            ? getRfiAttachments(client, projectId, original.id)
            : Promise.resolve(null as RfiAttachment[] | null),
          options.comments
            ? getRfiComments(client, projectId, original.id)
            : Promise.resolve(null as RfiComment[] | null),
        ]);
        const merged: Rfi = { ...detail };
        if (attachments) {
          merged.attachments = attachments;
          merged.attachmentCount = attachments.length;
        }
        if (comments) merged.comments = comments;
        out[i] = merged;
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

// Replace each RfiParty's `name` (which defaults to its id when normalised)
// with the resolved display name from the project user roster. Pure / cheap —
// runs in a useMemo so memoisation handles the cost.
export function applyUserRoster(
  rfis: Rfi[],
  roster: ReadonlyMap<string, string>,
): Rfi[] {
  if (roster.size === 0) return rfis;
  const fix = (p: RfiParty): RfiParty => {
    const resolved = roster.get(p.id);
    return resolved && resolved !== p.name ? { id: p.id, name: resolved } : p;
  };
  const fixList = (xs: RfiParty[]): RfiParty[] => {
    let changed = false;
    const out = xs.map((p) => {
      const next = fix(p);
      if (next !== p) changed = true;
      return next;
    });
    return changed ? out : xs;
  };
  return rfis.map((r) => {
    const assignees = fixList(r.assignees);
    const ballInCourt = fixList(r.ballInCourt);
    const coReviewers = fixList(r.coReviewers);
    const distributionList = fixList(r.distributionList);
    const watchers = fixList(r.watchers);
    const manager = r.manager ? fix(r.manager) : r.manager;
    if (
      assignees === r.assignees &&
      ballInCourt === r.ballInCourt &&
      coReviewers === r.coReviewers &&
      distributionList === r.distributionList &&
      watchers === r.watchers &&
      manager === r.manager
    ) {
      return r;
    }
    return {
      ...r,
      assignees,
      ballInCourt,
      coReviewers,
      distributionList,
      watchers,
      manager,
    };
  });
}
