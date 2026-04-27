export type HubKind = "acc" | "personal" | "unknown";

export interface Hub {
  id: string;
  name: string;
  region?: string;
  extensionType?: string;
  kind: HubKind;
}

export interface Project {
  id: string;
  hubId: string;
  name: string;
}

export type CustomAttributeType =
  | "text"
  | "numeric"
  | "singleChoice"
  | "multiChoice";

export interface CustomAttributeChoice {
  id: string;
  label: string;
}

export interface CustomAttributeDef {
  id: string;
  name: string;
  dataType: CustomAttributeType;
  values?: CustomAttributeChoice[];
  // True when this definition was derived from RFI payloads rather than
  // fetched from /attributes (e.g. because the user lacks "Manage Custom
  // Attributes" permission). Inferred defs only have an id + a best-guess
  // dataType — names default to the id and choice values are unresolved.
  inferred?: boolean;
}

export interface RfiParty {
  id: string;
  name: string;
}

export interface RfiAttachment {
  id: string;
  fileName?: string;
  displayName?: string;
  storageUrn?: string;
  attachmentType?: string;
  url?: string; // optional direct Forma deep link if APS returned one
}

export interface Rfi {
  id: string;
  number: string;
  title: string;
  status: string;
  statusLabel?: string;
  createdAt: string;
  updatedAt?: string;
  closedAt?: string;
  respondedAt?: string;
  dueDate?: string;
  // APS RFI v3 returns assignedTo as an array of { id, type } — we resolve
  // ids to names in a post-pass once the project user roster is loaded.
  assignees: RfiParty[];
  manager?: RfiParty;
  ballInCourt: RfiParty[];
  coReviewers: RfiParty[];
  distributionList: RfiParty[];
  watchers: RfiParty[];
  // Built-in scalar fields commonly surfaced in Forma's RFI UI. Each is
  // optional because APS only returns them on hydrated GETs and tenants
  // configure their RFI types differently.
  priority?: string;
  location?: string;
  locationDescription?: string;
  discipline?: string;
  category?: string;
  question?: string;
  officialResponse?: string;
  suggestedAnswer?: string;
  rfiTypeId?: string;
  // Catch-all for fields APS returns that we haven't explicitly modelled.
  // Lets the grid surface unexpected built-in fields without a code change.
  extra: Record<string, unknown>;
  // APS v3 returns each custom attribute as { id, values: [...] }, where `values`
  // is always an array — single-element for text/numeric/single-choice and
  // multi-element for multi-choice. We collapse the wire format into a record
  // keyed by attribute id, but keep `unknown[]` so display/filter logic doesn't
  // have to special-case scalars vs arrays.
  customAttributes: Record<string, unknown[]>;
  // Side-channel of metadata observed on each customAttribute entry —
  // populated when APS attaches the attribute's display name / type / choice
  // labels to its per-RFI value (which it commonly does on GET /rfis/:id even
  // when the /attributes schema endpoint is forbidden). The inferrer pulls
  // friendly names from here so non-admins can still see real titles.
  customAttributesMeta?: Record<string, ObservedCustomAttrMeta>;
  attachments: RfiAttachment[];
  attachmentCount: number;
  comments: RfiComment[];
}

export interface RfiComment {
  id: string;
  body: string;
  author?: RfiParty;
  createdAt?: string;
  attachments: RfiAttachment[];
  // True when this comment is the official RFI response, false for
  // informal back-and-forth.
  isOfficialResponse?: boolean;
}

export interface ObservedCustomAttrMeta {
  name?: string;
  dataType?: CustomAttributeType;
  values?: CustomAttributeChoice[];
}

export interface RfiSearchFilter {
  status?: string[];
  assignee?: string[];
  dueDate?: { gte?: string; lte?: string };
  createdAt?: { gte?: string; lte?: string };
  customAttributes?: Array<{ id: string; values: unknown[] }>;
}

export interface RfiSearchSort {
  field: string;
  order: "asc" | "desc";
}

export interface RfiSearchRequest {
  filter?: RfiSearchFilter;
  sort?: RfiSearchSort[];
  limit?: number;
  offset?: number;
}

export interface RfiSearchResponse {
  results: Rfi[];
  pagination: {
    limit: number;
    offset: number;
    totalResults?: number;
  };
}

export interface RfiScrapeProgress {
  loaded: number;
  total?: number;
}

export class ApsError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApsError";
  }
}
