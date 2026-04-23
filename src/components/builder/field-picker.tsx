"use client";

import type { CustomAttributeDef } from "@/lib/aps/types";
import { BUILTIN_COLUMNS, labelForField } from "@/lib/rfi/format";
import { customField, type FieldId } from "@/lib/report/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

interface Props {
  fields: FieldId[];
  onChange: (fields: FieldId[]) => void;
  customAttributes: CustomAttributeDef[];
}

export function FieldPicker({ fields, onChange, customAttributes }: Props) {
  const selected = new Set<FieldId>(fields);
  const allFields: FieldId[] = [
    ...BUILTIN_COLUMNS.map((c) => c.id as FieldId),
    ...customAttributes.map((a) => customField(a.id)),
  ];

  function toggle(id: FieldId) {
    if (selected.has(id)) onChange(fields.filter((f) => f !== id));
    else onChange([...fields, id]);
  }

  function move(index: number, delta: -1 | 1) {
    const next = [...fields];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    const a = next[index];
    const b = next[target];
    if (a === undefined || b === undefined) return;
    next[index] = b;
    next[target] = a;
    onChange(next);
  }

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-neutral-200">
      <h3 className="text-sm font-semibold">Columns</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Selected fields appear in this order in the report.
      </p>

      {fields.length > 0 ? (
        <ol className="mt-3 space-y-1">
          {fields.map((f, i) => (
            <li
              key={f}
              className="flex items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-sm"
            >
              <span className="flex-1 truncate">{labelForField(f, customAttributes)}</span>
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                aria-label={`Move ${labelForField(f, customAttributes)} up`}
                className="rounded px-1.5 text-neutral-500 hover:bg-neutral-200 disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === fields.length - 1}
                aria-label={`Move ${labelForField(f, customAttributes)} down`}
                className="rounded px-1.5 text-neutral-500 hover:bg-neutral-200 disabled:opacity-30"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => toggle(f)}
                aria-label={`Remove ${labelForField(f, customAttributes)}`}
                className="rounded px-1.5 text-red-500 hover:bg-red-50"
              >
                ✕
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-3 rounded-md border border-dashed border-neutral-300 p-3 text-xs text-neutral-500">
          No columns selected.
        </p>
      )}

      <div className="mt-4">
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">
          Available
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {allFields
            .filter((f) => !selected.has(f))
            .map((f) => (
              <Button
                key={f}
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => toggle(f)}
                className={cn("text-xs")}
              >
                + {labelForField(f, customAttributes)}
              </Button>
            ))}
        </div>
      </div>
    </div>
  );
}
