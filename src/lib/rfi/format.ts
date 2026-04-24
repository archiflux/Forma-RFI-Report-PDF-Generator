import type { CustomAttributeDef, Rfi } from "@/lib/aps/types";
import {
  type BuiltinFieldId,
  type FieldId,
  customAttrId,
  isCustomField,
} from "@/lib/report/types";

export function formatDate(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function formatCustomAttributeValue(
  def: CustomAttributeDef,
  raw: unknown,
): string {
  if (raw === undefined || raw === null) return "";

  if (def.dataType === "singleChoice") {
    const id = typeof raw === "string" ? raw : (raw as { id?: string }).id;
    return def.values?.find((v) => v.id === id)?.label ?? String(id ?? "");
  }
  if (def.dataType === "multiChoice") {
    const ids = Array.isArray(raw)
      ? raw.map((r) => (typeof r === "string" ? r : (r as { id?: string }).id))
      : [];
    return ids
      .map((id) => def.values?.find((v) => v.id === id)?.label ?? id ?? "")
      .filter(Boolean)
      .join(" | ");
  }
  if (def.dataType === "numeric") {
    return typeof raw === "number" ? String(raw) : String(raw ?? "");
  }
  return String(raw);
}

export interface BuiltinColumnMeta {
  id: BuiltinFieldId;
  label: string;
}

export const BUILTIN_COLUMNS: readonly BuiltinColumnMeta[] = [
  { id: "number", label: "RFI #" },
  { id: "title", label: "Title" },
  { id: "statusLabel", label: "Status" },
  { id: "assignee", label: "Assignee" },
  { id: "manager", label: "Manager" },
  { id: "dueDate", label: "Due" },
  { id: "createdAt", label: "Created" },
  { id: "attachmentCount", label: "Attachments" },
  { id: "question", label: "Question" },
  { id: "officialResponse", label: "Official response" },
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

export function getBuiltinValue(rfi: Rfi, column: BuiltinFieldId): string {
  switch (column) {
    case "number":
      return rfi.number;
    case "title":
      return rfi.title;
    case "statusLabel":
      return rfi.statusLabel ?? rfi.status;
    case "assignee":
      return rfi.assignee?.name ?? "";
    case "manager":
      return rfi.manager?.name ?? "";
    case "dueDate":
      return formatDate(rfi.dueDate);
    case "createdAt":
      return formatDate(rfi.createdAt);
    case "attachmentCount":
      return String(rfi.attachmentCount ?? 0);
    case "question":
      return rfi.question ?? "";
    case "officialResponse":
      return rfi.officialResponse ?? "";
  }
}

// Unified field accessor — returns the raw value for sorting/grouping where
// that matters (dates as ISO strings sort naturally; numbers stay numbers).
// Missing values come back as null so compareValues can sort them last.
export function getFieldValue(
  rfi: Rfi,
  field: FieldId,
  customAttributes: CustomAttributeDef[],
): string | number | null {
  if (isCustomField(field)) {
    const def = customAttributes.find((a) => a.id === customAttrId(field));
    if (!def) return null;
    const ca = rfi.customAttributes;
    const raw = ca && typeof ca === "object" ? ca[def.id] : undefined;
    if (raw === undefined || raw === null) return null;
    if (def.dataType === "numeric" && typeof raw === "number") return raw;
    const formatted = formatCustomAttributeValue(def, raw);
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
      const v = getBuiltinValue(rfi, field);
      return v === "" ? null : v;
    }
  }
}

// Display-string form (used by the preview grid and exports).
export function getFieldDisplay(
  rfi: Rfi,
  field: FieldId,
  customAttributes: CustomAttributeDef[],
): string {
  const v = getFieldValue(rfi, field, customAttributes);
  return v === null ? "" : String(v);
}
