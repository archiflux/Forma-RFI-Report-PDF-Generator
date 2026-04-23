import type { CustomAttributeDef, Rfi } from "@/lib/aps/types";
import { getFieldValue } from "@/lib/rfi/format";
import {
  type FieldId,
  type FilterSpec,
  type ReportTemplate,
  type SortSpec,
  customAttrId,
  isCustomField,
} from "./types";

// ---- Filter -----------------------------------------------------------------

function dateInRange(iso: string | undefined, range: { gte?: string; lte?: string }): boolean {
  if (!iso) return false;
  const date = iso.slice(0, 10);
  if (range.gte && date < range.gte) return false;
  if (range.lte && date > range.lte) return false;
  return true;
}

function valueOfCustomAttr(rfi: Rfi, attrId: string): unknown {
  return rfi.customAttributes[attrId];
}

function customAttrMatches(
  def: CustomAttributeDef,
  raw: unknown,
  clause: { contains?: string; range?: { gte?: number; lte?: number }; values?: string[] },
): boolean {
  if (clause.contains && typeof clause.contains === "string") {
    const v = raw === null || raw === undefined ? "" : String(raw);
    if (!v.toLowerCase().includes(clause.contains.toLowerCase())) return false;
  }
  if (clause.range && def.dataType === "numeric") {
    const n = typeof raw === "number" ? raw : Number(raw);
    if (Number.isNaN(n)) return false;
    if (clause.range.gte !== undefined && n < clause.range.gte) return false;
    if (clause.range.lte !== undefined && n > clause.range.lte) return false;
  }
  if (clause.values && clause.values.length > 0) {
    if (def.dataType === "singleChoice") {
      const id = typeof raw === "string" ? raw : (raw as { id?: string } | null)?.id;
      if (!id || !clause.values.includes(id)) return false;
    } else if (def.dataType === "multiChoice") {
      const ids = Array.isArray(raw)
        ? raw
            .map((r) => (typeof r === "string" ? r : (r as { id?: string }).id))
            .filter((x): x is string => Boolean(x))
        : [];
      // "any of" semantics: at least one selected value must be present on the RFI.
      if (!ids.some((id) => clause.values!.includes(id))) return false;
    }
  }
  return true;
}

export function applyFilter(
  rfis: Rfi[],
  filter: FilterSpec,
  customAttributes: CustomAttributeDef[],
): Rfi[] {
  const search = filter.search?.trim().toLowerCase();
  const assigneeNeedle = filter.assigneeContains?.trim().toLowerCase();
  const statusSet = filter.status && filter.status.length > 0 ? new Set(filter.status) : null;
  const attrDefs = new Map(customAttributes.map((a) => [a.id, a]));

  return rfis.filter((r) => {
    if (search) {
      const hay = [r.number, r.title, r.question, r.officialResponse]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(search)) return false;
    }

    if (statusSet) {
      // Match either raw id or resolved label.
      const matches = statusSet.has(r.status) || (r.statusLabel ? statusSet.has(r.statusLabel) : false);
      if (!matches) return false;
    }

    if (assigneeNeedle) {
      const name = r.assignee?.name?.toLowerCase() ?? "";
      if (!name.includes(assigneeNeedle)) return false;
    }

    if (filter.dueDate && (filter.dueDate.gte || filter.dueDate.lte)) {
      if (!dateInRange(r.dueDate, filter.dueDate)) return false;
    }
    if (filter.createdAt && (filter.createdAt.gte || filter.createdAt.lte)) {
      if (!dateInRange(r.createdAt, filter.createdAt)) return false;
    }

    if (filter.customAttributes) {
      for (const [attrId, clause] of Object.entries(filter.customAttributes)) {
        const def = attrDefs.get(attrId);
        if (!def) continue; // attribute not in this project — skip, don't fail.
        const isEmpty =
          !clause.contains &&
          !clause.range?.gte &&
          !clause.range?.lte &&
          (!clause.values || clause.values.length === 0);
        if (isEmpty) continue;
        if (!customAttrMatches(def, valueOfCustomAttr(r, attrId), clause)) return false;
      }
    }

    return true;
  });
}

// ---- Sort -------------------------------------------------------------------

function compareDefined(a: string | number, b: string | number): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

// Nulls are ALWAYS sorted last, regardless of asc/desc direction — otherwise
// descending a date column would surface "no due date" rows at the top, which
// is almost never what a user wants.
function compareWithNullsLast(
  a: string | number | null,
  b: string | number | null,
  order: "asc" | "desc",
): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const cmp = compareDefined(a, b);
  return order === "asc" ? cmp : -cmp;
}

export function applySort(
  rfis: Rfi[],
  sort: SortSpec[],
  customAttributes: CustomAttributeDef[],
): Rfi[] {
  if (sort.length === 0) return rfis;
  const copy = [...rfis];
  copy.sort((a, b) => {
    for (const s of sort) {
      const av = getFieldValue(a, s.field, customAttributes);
      const bv = getFieldValue(b, s.field, customAttributes);
      const cmp = compareWithNullsLast(av, bv, s.order);
      if (cmp !== 0) return cmp;
    }
    return 0;
  });
  return copy;
}

// ---- Group ------------------------------------------------------------------

export interface RfiGroup {
  key: string;
  label: string;
  rfis: Rfi[];
}

export function applyGroupBy(
  rfis: Rfi[],
  groupBy: FieldId | undefined,
  customAttributes: CustomAttributeDef[],
): RfiGroup[] {
  if (!groupBy) return [{ key: "__all__", label: "All RFIs", rfis }];
  const map = new Map<string, Rfi[]>();
  for (const r of rfis) {
    const v = getFieldValue(r, groupBy, customAttributes);
    const key = v === null || v === "" ? "(empty)" : String(v);
    const arr = map.get(key);
    if (arr) arr.push(r);
    else map.set(key, [r]);
  }
  const label = isCustomField(groupBy)
    ? customAttributes.find((a) => a.id === customAttrId(groupBy))?.name ?? String(groupBy)
    : String(groupBy);
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([key, rs]) => ({ key, label: `${label}: ${key}`, rfis: rs }));
}

// ---- Compose ----------------------------------------------------------------

export function applyTemplate(
  rfis: Rfi[],
  template: ReportTemplate,
  customAttributes: CustomAttributeDef[],
): { filtered: Rfi[]; groups: RfiGroup[]; totalBeforeFilter: number } {
  const filtered = applyFilter(rfis, template.filter, customAttributes);
  const sorted = applySort(filtered, template.sort, customAttributes);
  const groups = applyGroupBy(sorted, template.groupBy, customAttributes);
  return { filtered: sorted, groups, totalBeforeFilter: rfis.length };
}
