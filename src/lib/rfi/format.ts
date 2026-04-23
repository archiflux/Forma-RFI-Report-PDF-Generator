import type { CustomAttributeDef, Rfi } from "@/lib/aps/types";

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

// Built-in columns always available regardless of custom attributes.
export const BUILTIN_COLUMNS = [
  { id: "number", label: "RFI #" },
  { id: "title", label: "Title" },
  { id: "statusLabel", label: "Status" },
  { id: "assignee", label: "Assignee" },
  { id: "dueDate", label: "Due" },
  { id: "createdAt", label: "Created" },
  { id: "attachmentCount", label: "Attachments" },
] as const;

export type BuiltinColumnId = (typeof BUILTIN_COLUMNS)[number]["id"];

export function getBuiltinValue(rfi: Rfi, column: BuiltinColumnId): string {
  switch (column) {
    case "number":
      return rfi.number;
    case "title":
      return rfi.title;
    case "statusLabel":
      return rfi.statusLabel ?? rfi.status;
    case "assignee":
      return rfi.assignee?.name ?? "";
    case "dueDate":
      return formatDate(rfi.dueDate);
    case "createdAt":
      return formatDate(rfi.createdAt);
    case "attachmentCount":
      return String(rfi.attachmentCount ?? 0);
  }
}
