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
    <div className="rounded-xl bg-white shadow-sm ring-1 ring-neutral-200">
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
        <h3 className="text-sm font-semibold">Preview</h3>
        <p className="text-xs text-neutral-500">
          {totalAfterFilter.toLocaleString()} of {totalBeforeFilter.toLocaleString()} RFIs
          · {fields.length} column{fields.length === 1 ? "" : "s"}
          {groups.length > 1 ? ` · ${groups.length} groups` : ""}
        </p>
      </div>

      <div className="overflow-x-auto">
        {fields.length === 0 ? (
          <p className="px-4 py-6 text-sm text-neutral-500">
            Pick at least one column to see a preview.
          </p>
        ) : (
          <table className="min-w-full divide-y divide-neutral-200 text-sm">
            <thead className="bg-neutral-50">
              <tr>
                {fields.map((f) => (
                  <th
                    key={f}
                    scope="col"
                    className="sticky top-0 bg-neutral-50 px-3 py-2 text-left font-medium text-neutral-700"
                  >
                    {labelForField(f, customAttributes)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
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
                    className="px-3 py-6 text-center text-neutral-500"
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
    <tr className={cn(zebra ? "bg-neutral-50/50" : "")}>
      {fields.map((f) => (
        <td key={f} className="max-w-sm truncate px-3 py-2 align-top text-neutral-800">
          {getFieldDisplay(rfi, f, customAttributes)}
        </td>
      ))}
    </tr>
  );
}
