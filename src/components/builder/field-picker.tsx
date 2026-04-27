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
    <div className="rounded-2xl border border-[color:var(--brand-border)] bg-white p-4 shadow-card sm:p-5">
      <h3 className="text-sm font-semibold text-[color:var(--brand-primary)]">
        Columns
      </h3>
      <p className="mt-1 text-xs text-[color:var(--brand-muted)]">
        Selected fields appear in this order in the report.
      </p>

      {fields.length > 0 ? (
        <ol className="mt-3 space-y-1.5">
          {fields.map((f, i) => (
            <li
              key={f}
              className="flex items-center gap-2 rounded-lg border border-[color:var(--brand-border)] bg-[color:var(--brand-canvas)] px-2.5 py-1.5 text-sm"
            >
              <span className="flex-1 truncate font-medium text-[color:var(--brand-ink)]">
                {labelForField(f, customAttributes)}
              </span>
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                aria-label={`Move ${labelForField(f, customAttributes)} up`}
                className="rounded-md px-1.5 text-[color:var(--brand-muted)] hover:bg-white hover:text-[color:var(--brand-primary)] disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === fields.length - 1}
                aria-label={`Move ${labelForField(f, customAttributes)} down`}
                className="rounded-md px-1.5 text-[color:var(--brand-muted)] hover:bg-white hover:text-[color:var(--brand-primary)] disabled:opacity-30"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => toggle(f)}
                aria-label={`Remove ${labelForField(f, customAttributes)}`}
                className="rounded-md px-1.5 text-red-500 hover:bg-red-50"
              >
                ✕
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-3 rounded-lg border border-dashed border-[color:var(--brand-border)] p-3 text-xs text-[color:var(--brand-muted)]">
          No columns selected.
        </p>
      )}

      <div className="mt-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--brand-secondary)]">
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
