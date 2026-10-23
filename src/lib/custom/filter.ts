// Custom-field filtering shared by the dashboards. Records expose their
// custom fields as name -> display text; multi-select values are joined
// with " | " (see the normalisers), so a filter on one option matches a
// record that has it among several.

export type CustomFilters = Record<string, string[]>;

export const NOT_SET = "Not set";

export function customValues(text: string | undefined): string[] {
  if (!text) return [NOT_SET];
  const parts = text.split(" | ").map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts : [NOT_SET];
}

export function matchesCustom(custom: Record<string, string> | undefined, filters: CustomFilters): boolean {
  for (const [field, wanted] of Object.entries(filters)) {
    if (!wanted.length) continue;
    const have = customValues(custom?.[field]);
    if (!wanted.some((w) => have.includes(w))) return false;
  }
  return true;
}

// Field names present on any record, most-populated first, with the
// distinct values of each (sorted, "Not set" last).
export function customFieldIndex(customs: Array<Record<string, string> | undefined>): Array<{ field: string; count: number; values: string[] }> {
  const fields = new Map<string, { count: number; values: Set<string> }>();
  for (const c of customs) {
    for (const [field, text] of Object.entries(c ?? {})) {
      const e = fields.get(field) ?? { count: 0, values: new Set<string>() };
      e.count++;
      for (const v of customValues(text)) e.values.add(v);
      fields.set(field, e);
    }
  }
  const total = customs.length;
  return [...fields.entries()]
    .map(([field, e]) => {
      const values = [...e.values].sort((a, b) => a.localeCompare(b));
      if (e.count < total && !values.includes(NOT_SET)) values.push(NOT_SET);
      return { field, count: e.count, values };
    })
    .sort((a, b) => b.count - a.count || a.field.localeCompare(b.field));
}

export function describeCustom(filters: CustomFilters): Array<[string, string[]]> {
  return Object.entries(filters).filter(([, v]) => v.length).map(([field, v]) => [field, v]);
}
