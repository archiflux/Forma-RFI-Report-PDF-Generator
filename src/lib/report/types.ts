// Report templates — the saved shape that answers: "what fields, what filters,
// what sort, what group-by, what output format?"
//
// Filtering happens client-side in Phase 3 so the builder gives instant
// feedback against the already-scraped RFI set. Phase 6 can translate these
// filter specs into APS search:rfis payloads for server-side filtering of
// very large projects.

// Built-in fields. Derived from Rfi in src/lib/aps/types.ts.
export const BUILTIN_FIELD_IDS = [
  "number",
  "title",
  "statusLabel",
  "assignee",
  "manager",
  "dueDate",
  "createdAt",
  "attachmentCount",
  "question",
  "officialResponse",
] as const;

export type BuiltinFieldId = (typeof BUILTIN_FIELD_IDS)[number];

// "custom:<attrId>" addresses a custom-attribute column.
export type CustomFieldId = `custom:${string}`;
export type FieldId = BuiltinFieldId | CustomFieldId;

export function isCustomField(id: FieldId): id is CustomFieldId {
  return id.startsWith("custom:");
}
export function customAttrId(id: CustomFieldId): string {
  return id.slice("custom:".length);
}
export function customField(attrId: string): CustomFieldId {
  return `custom:${attrId}` as CustomFieldId;
}

// Per-field filter clauses. An undefined clause means "no constraint on this field".
export interface DateRange {
  gte?: string; // ISO yyyy-mm-dd
  lte?: string;
}

export interface NumberRange {
  gte?: number;
  lte?: number;
}

export interface FilterSpec {
  // Free-text search across number/title/question/officialResponse.
  search?: string;
  // Multi-select over status label (resolved) OR raw id.
  status?: string[];
  // "Assignee name contains" — we don't yet index user id lookups, so string match.
  assigneeContains?: string;
  dueDate?: DateRange;
  createdAt?: DateRange;
  // Per custom-attribute filters keyed by attribute id.
  customAttributes?: Record<
    string,
    {
      contains?: string; // text attrs
      range?: NumberRange; // numeric attrs
      values?: string[]; // single/multi choice attr value ids
    }
  >;
}

export interface SortSpec {
  field: FieldId;
  order: "asc" | "desc";
}

export type OutputFormat = "pdf" | "csv";

export interface ReportTemplate {
  id: string;
  name: string;
  // Project the template was born in. Templates are portable across projects
  // — custom-attribute references that don't exist in the new project are
  // silently skipped when loaded.
  createdInProjectId: string;
  fields: FieldId[];
  filter: FilterSpec;
  sort: SortSpec[];
  groupBy?: FieldId;
  output: OutputFormat;
  pageSize?: "A4" | "Letter";
  orientation?: "portrait" | "landscape";
  brandId?: string;
  createdAt: string;
  updatedAt: string;
}

export const TEMPLATE_JSON_VERSION = 1;

export interface TemplateExportEnvelope {
  $schema: "forma-rfi-report-template";
  version: typeof TEMPLATE_JSON_VERSION;
  template: ReportTemplate;
}

export function emptyTemplate(projectId: string): ReportTemplate {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: "Untitled report",
    createdInProjectId: projectId,
    fields: ["number", "title", "statusLabel", "assignee", "dueDate"],
    filter: {},
    sort: [{ field: "dueDate", order: "asc" }],
    output: "pdf",
    pageSize: "A4",
    orientation: "portrait",
    createdAt: now,
    updatedAt: now,
  };
}
