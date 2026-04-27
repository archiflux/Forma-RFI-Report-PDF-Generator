"use client";

import type { CustomAttributeDef } from "@/lib/aps/types";
import { BUILTIN_COLUMNS, labelForField } from "@/lib/rfi/format";
import { customField, type FieldId, type SortSpec } from "@/lib/report/types";
import { Button } from "@/components/ui/button";

interface Props {
  sort: SortSpec[];
  onChange: (next: SortSpec[]) => void;
  groupBy: FieldId | undefined;
  onGroupByChange: (g: FieldId | undefined) => void;
  customAttributes: CustomAttributeDef[];
}

export function SortPicker({
  sort,
  onChange,
  groupBy,
  onGroupByChange,
  customAttributes,
}: Props) {
  const allFields: FieldId[] = [
    ...BUILTIN_COLUMNS.map((c) => c.id as FieldId),
    ...customAttributes.map((a) => customField(a.id)),
  ];

  function updateAt(i: number, patch: Partial<SortSpec>) {
    const next = [...sort];
    const curr = next[i];
    if (!curr) return;
    next[i] = { ...curr, ...patch };
    onChange(next);
  }

  function removeAt(i: number) {
    onChange(sort.filter((_, j) => j !== i));
  }

  function addSort() {
    const firstUnused = allFields.find((f) => !sort.some((s) => s.field === f));
    if (!firstUnused) return;
    onChange([...sort, { field: firstUnused, order: "asc" }]);
  }

  const labelClass =
    "text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--brand-secondary)]";
  const selectClass =
    "rounded-lg border border-[color:var(--brand-border)] bg-white px-2 py-1.5 text-sm outline-none transition-colors focus:border-[color:var(--brand-primary)] focus:ring-2 focus:ring-[color:var(--brand-primary)]/20";

  return (
    <div className="rounded-2xl border border-[color:var(--brand-border)] bg-white p-4 shadow-card sm:p-5">
      <h3 className="text-sm font-semibold text-[color:var(--brand-primary)]">
        Sort &amp; group
      </h3>

      <div className="mt-3">
        <p className={labelClass}>Sort by</p>
        <ol className="mt-2 space-y-2">
          {sort.map((s, i) => (
            <li key={`${s.field}-${i}`} className="flex items-center gap-2">
              <select
                value={s.field}
                onChange={(e) => updateAt(i, { field: e.target.value as FieldId })}
                className={`${selectClass} flex-1`}
              >
                {allFields.map((f) => (
                  <option key={f} value={f}>
                    {labelForField(f, customAttributes)}
                  </option>
                ))}
              </select>
              <select
                value={s.order}
                onChange={(e) => updateAt(i, { order: e.target.value as "asc" | "desc" })}
                className={selectClass}
              >
                <option value="asc">Asc</option>
                <option value="desc">Desc</option>
              </select>
              <button
                type="button"
                onClick={() => removeAt(i)}
                aria-label="Remove sort"
                className="rounded-md px-1.5 text-red-500 hover:bg-red-50"
              >
                ✕
              </button>
            </li>
          ))}
        </ol>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={addSort}
          className="mt-2"
        >
          + Add sort
        </Button>
      </div>

      <div className="mt-4">
        <p className={labelClass}>Group by</p>
        <select
          value={groupBy ?? ""}
          onChange={(e) => onGroupByChange((e.target.value || undefined) as FieldId | undefined)}
          className={`${selectClass} mt-2 w-full`}
        >
          <option value="">(none)</option>
          {allFields.map((f) => (
            <option key={f} value={f}>
              {labelForField(f, customAttributes)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
