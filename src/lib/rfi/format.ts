import type { CustomAttributeDef, Rfi } from "@/lib/aps/types";
import { issueUrl, rfiUrl } from "@/lib/aps/links";
import {
  type BuiltinFieldId,
  type FieldId,
  customAttrId,
  isCustomField,
} from "@/lib/report/types";

export interface FormatContext {
  projectId?: string;
  itemKind?: "rfi" | "issue";
}

export function formatDate(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

// Format a custom-attribute value for display. After src/lib/aps/rfis.ts
// normalisation, `raw` should be the values array (unknown[]) lifted from
// APS's { id, values: [...] } shape — but we tolerate scalars + null too
// in case something slips past the normaliser.
export function formatCustomAttributeValue(
  def: CustomAttributeDef,
  raw: unknown,
): string {
  if (raw === undefined || raw === null) return "";
  const items: unknown[] = Array.isArray(raw) ? raw : [raw];
  if (items.length === 0) return "";

  return items
    .map((v) => formatChoiceOrScalar(def, v))
    .filter((s) => s !== "")
    .join(" | ");
}

function formatChoiceOrScalar(def: CustomAttributeDef, v: unknown): string {
  if (v === null || v === undefined) return "";
  // Choice values come through as either an id string ("uuid…") or as
  // { id, label, value } objects. When def.values is populated (i.e. we
  // fetched the schema), resolve the id to its human label.
  let id: string | undefined;
  if (typeof v === "string") id = v;
  else if (typeof v === "object") id = (v as { id?: string }).id;

  if (def.values && id) {
    const choice = def.values.find((c) => c.id === id);
    if (choice) return choice.label;
  }
  // Fall back to the value's own label/value, then to a stringification.
  if (typeof v === "object") {
    const obj = v as { label?: string; value?: unknown; id?: string };
    if (typeof obj.label === "string") return obj.label;
    if (obj.value !== undefined && obj.value !== null) return String(obj.value);
    if (typeof obj.id === "string") return obj.id;
    return "";
  }
  return String(v);
}

export interface BuiltinColumnMeta {
  id: BuiltinFieldId;
  label: string;
}

export const BUILTIN_COLUMNS: readonly BuiltinColumnMeta[] = [
  { id: "number", label: "RFI #" },
  { id: "title", label: "Title" },
  { id: "statusLabel", label: "Status" },
  { id: "priority", label: "Priority" },
  { id: "assignee", label: "Assignee" },
  { id: "manager", label: "Manager" },
  { id: "ballInCourt", label: "Ball in court" },
  { id: "coReviewers", label: "Co-reviewers" },
  { id: "distributionList", label: "Distribution list" },
  { id: "watchers", label: "Watchers" },
  { id: "location", label: "Location" },
  { id: "locationDescription", label: "Location description" },
  { id: "discipline", label: "Discipline" },
  { id: "category", label: "Category" },
  { id: "dueDate", label: "Due" },
  { id: "createdAt", label: "Created" },
  { id: "updatedAt", label: "Updated" },
  { id: "respondedAt", label: "Responded" },
  { id: "closedAt", label: "Closed" },
  { id: "attachmentCount", label: "Attachments" },
  { id: "attachmentList", label: "Attachment files" },
  { id: "question", label: "Question" },
  { id: "officialResponse", label: "Official response" },
  { id: "suggestedAnswer", label: "Suggested answer" },
  { id: "formaUrl", label: "Forma URL" },
];

export function labelForField(
  id: FieldId,
  customAttributes: CustomAttributeDef[],
): string {
  if (isCustomField(id)) {
    const aid = customAttrId(id);
    const def = customAttributes.find((a) => a.id === aid);
    return def ? `${def.name} (custom)` : `${aid} (custom)`;
  }
  return BUILTIN_COLUMNS.find((c) => c.id === id)?.label ?? id;
}

function partyListNames(parties: { name: string }[] | undefined): string {
  return (parties ?? []).map((p) => p.name).filter(Boolean).join(", ");
}

export function getBuiltinValue(
  rfi: Rfi,
  column: BuiltinFieldId,
  ctx?: FormatContext,
): string {
  switch (column) {
    case "number":
      return rfi.number;
    case "title":
      return rfi.title;
    case "statusLabel":
      return rfi.statusLabel ?? rfi.status;
    case "priority":
      return rfi.priority ?? "";
    case "assignee":
      return partyListNames(rfi.assignees);
    case "manager":
      return rfi.manager?.name ?? "";
    case "ballInCourt":
      return partyListNames(rfi.ballInCourt);
    case "coReviewers":
      return partyListNames(rfi.coReviewers);
    case "distributionList":
      return partyListNames(rfi.distributionList);
    case "watchers":
      return partyListNames(rfi.watchers);
    case "location":
      return rfi.location ?? "";
    case "locationDescription":
      return rfi.locationDescription ?? "";
    case "discipline":
      return rfi.discipline ?? "";
    case "category":
      return rfi.category ?? "";
    case "dueDate":
      return formatDate(rfi.dueDate);
    case "createdAt":
      return formatDate(rfi.createdAt);
    case "updatedAt":
      return formatDate(rfi.updatedAt);
    case "respondedAt":
      return formatDate(rfi.respondedAt);
    case "closedAt":
      return formatDate(rfi.closedAt);
    case "attachmentCount":
      return String(rfi.attachmentCount ?? 0);
    case "attachmentList":
      return (rfi.attachments ?? [])
        .map((a) => a.displayName ?? a.fileName ?? a.id)
        .filter(Boolean)
        .join(" | ");
    case "question":
      return rfi.question ?? "";
    case "officialResponse":
      return rfi.officialResponse ?? "";
    case "suggestedAnswer":
      return rfi.suggestedAnswer ?? "";
    case "formaUrl":
      if (!ctx?.projectId || !rfi.id) return "";
      return ctx.itemKind === "issue"
        ? issueUrl(ctx.projectId, rfi.id)
        : rfiUrl(ctx.projectId, rfi.id);
  }
}

// Unified field accessor — returns the raw value for sorting/grouping where
// that matters (dates as ISO strings sort naturally; numbers stay numbers).
// Missing values come back as null so compareValues can sort them last.
export function getFieldValue(
  rfi: Rfi,
  field: FieldId,
  customAttributes: CustomAttributeDef[],
  ctx?: FormatContext,
): string | number | null {
  if (isCustomField(field)) {
    const def = customAttributes.find((a) => a.id === customAttrId(field));
    if (!def) return null;
    const ca = rfi.customAttributes;
    const values = ca && typeof ca === "object" ? ca[def.id] : undefined;
    if (!values || values.length === 0) return null;

    // Numeric attributes have a single number in their values array.
    if (def.dataType === "numeric") {
      const first = values[0];
      if (typeof first === "number") return first;
      const n = Number(first);
      return Number.isNaN(n) ? null : n;
    }

    const formatted = formatCustomAttributeValue(def, values);
    return formatted === "" ? null : formatted;
  }
  switch (field) {
    case "attachmentCount":
      return rfi.attachmentCount ?? 0;
    case "dueDate":
      return rfi.dueDate ?? null;
    case "createdAt":
      return rfi.createdAt ?? null;
    default: {
      const v = getBuiltinValue(rfi, field, ctx);
      return v === "" ? null : v;
    }
  }
}

// Display-string form (used by the preview grid and exports).
export function getFieldDisplay(
  rfi: Rfi,
  field: FieldId,
  customAttributes: CustomAttributeDef[],
  ctx?: FormatContext,
): string {
  const v = getFieldValue(rfi, field, customAttributes, ctx);
  return v === null ? "" : String(v);
}
