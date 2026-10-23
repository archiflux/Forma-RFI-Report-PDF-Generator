"use client";

import { useMemo, useState } from "react";
import { customFieldIndex, type CustomFilters } from "@/lib/custom/filter";
import { MultiSelect } from "./multi-select";

// "Custom field" picker plus a value multi-select for each field in use.
// Renders nothing when the records carry no custom fields.
export function CustomFieldFilter({
  customs,
  value,
  onChange,
}: {
  customs: Array<Record<string, string> | undefined>;
  value: CustomFilters;
  onChange: (next: CustomFilters) => void;
}) {
  const index = useMemo(() => customFieldIndex(customs), [customs]);
  const [adding, setAdding] = useState("");
  if (!index.length) return null;
  const active = Object.keys(value);
  const available = index.filter((f) => !active.includes(f.field));

  return (
    <>
      {active.map((field) => {
        const entry = index.find((f) => f.field === field);
        return (
          <span key={field} className="flex items-center gap-1">
            <MultiSelect
              label={field}
              options={(entry?.values ?? []).map((v) => ({ value: v, label: v }))}
              value={value[field] ?? []}
              onChange={(v) => onChange({ ...value, [field]: v })}
            />
            <button
              type="button"
              aria-label={`Remove ${field} filter`}
              className="text-xs text-[color:var(--brand-muted)] hover:text-[color:var(--status-critical)]"
              onClick={() => {
                const next = { ...value };
                delete next[field];
                onChange(next);
              }}
            >
              ✕
            </button>
          </span>
        );
      })}
      {available.length ? (
        <select
          value={adding}
          onChange={(e) => {
            const f = e.target.value;
            setAdding("");
            if (f) onChange({ ...value, [f]: [] });
          }}
          className="min-h-9 max-w-[14rem] rounded-lg border border-[color:var(--brand-border)] bg-white px-2 text-xs text-[color:var(--brand-muted)]"
        >
          <option value="">+ Custom field filter</option>
          {available.map((f) => (
            <option key={f.field} value={f.field}>
              {f.field} ({f.count})
            </option>
          ))}
        </select>
      ) : null}
    </>
  );
}
