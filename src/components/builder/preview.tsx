"use client";

import type { CustomAttributeDef, Rfi } from "@/lib/aps/types";
import { getFieldDisplay, labelForField } from "@/lib/rfi/format";
import type { RfiGroup } from "@/lib/report/apply";
import type { FieldId } from "@/lib/report/types";
import { cn } from "@/lib/cn";

interface Props {
  groups: RfiGroup[];
  fields: FieldId[];
  customAttributes: CustomAttributeDef[];
  totalBeforeFilter: number;
  totalAfterFilter: number;
}

const ROW_CAP_PER_GROUP = 100;

export function Preview({
  groups,
  fields,
  customAttributes,
  totalBeforeFilter,
  totalAfterFilter,
}: Props) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[color:var(--brand-border)] bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-[color:var(--brand-border)] px-5 py-3">
        <h3 className="text-sm font-semibold text-[color:var(--brand-primary)]">
          Preview
        </h3>
        <p className="text-xs text-[color:var(--brand-muted)]">
          {totalAfterFilter.toLocaleString()} of {totalBeforeFilter.toLocaleString()} RFIs
          · {fields.length} column{fields.length === 1 ? "" : "s"}
          {groups.length > 1 ? ` · ${groups.length} groups` : ""}
        </p>
      </div>

      <div className="overflow-x-auto">
        {fields.length === 0 ? (
          <p className="px-5 py-6 text-sm text-[color:var(--brand-muted)]">
            Pick at least one column to see a preview.
          </p>
        ) : (
          <table className="min-w-full divide-y divide-[color:var(--brand-border)] text-sm">
            <thead className="bg-[color:var(--brand-canvas)]">
              <tr>
                {fields.map((f) => (
                  <th
                    key={f}
                    scope="col"
                    className="sticky top-0 bg-[color:var(--brand-canvas)] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--brand-secondary)]"
                  >
                    {labelForField(f, customAttributes)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--brand-border)]">
              {groups.map((g) => (
                <GroupSection
                  key={g.key}
                  group={g}
                  fields={fields}
                  customAttributes={customAttributes}
                  showHeader={groups.length > 1}
                />
              ))}
              {totalAfterFilter === 0 ? (
                <tr>
                  <td
                    colSpan={fields.length}
                    className="px-3 py-6 text-center text-[color:var(--brand-muted)]"
                  >
                    No RFIs match the current filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function GroupSection({
  group,
  fields,
  customAttributes,
  showHeader,
}: {
  group: RfiGroup;
  fields: FieldId[];
  customAttributes: CustomAttributeDef[];
  showHeader: boolean;
}) {
  const capped = group.rfis.slice(0, ROW_CAP_PER_GROUP);
  const hidden = group.rfis.length - capped.length;
  return (
    <>
      {showHeader ? (
        <tr className="bg-[color:var(--brand-primary)]/5">
          <th
            colSpan={fields.length}
            scope="colgroup"
            className="px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-wider text-[color:var(--brand-primary)]"
          >
            {group.label} · {group.rfis.length}
          </th>
        </tr>
      ) : null}
      {capped.map((r, i) => (
        <Row key={r.id} rfi={r} fields={fields} customAttributes={customAttributes} zebra={i % 2 === 1} />
      ))}
      {hidden > 0 ? (
        <tr>
          <td colSpan={fields.length} className="px-3 py-1.5 text-center text-xs text-neutral-500">
            +{hidden.toLocaleString()} more rows in this group (all will appear in the exported report)
          </td>
        </tr>
      ) : null}
    </>
  );
}

function Row({
  rfi,
  fields,
  customAttributes,
  zebra,
}: {
  rfi: Rfi;
  fields: FieldId[];
  customAttributes: CustomAttributeDef[];
  zebra: boolean;
}) {
  return (
    <tr className={cn(zebra ? "bg-[color:var(--brand-canvas)]/60" : "")}>
      {fields.map((f) => (
        <td
          key={f}
          className="max-w-sm truncate px-3 py-2 align-top text-[color:var(--brand-ink)]"
        >
          {getFieldDisplay(rfi, f, customAttributes)}
        </td>
      ))}
    </tr>
  );
}
