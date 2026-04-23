"use client";

import { useMemo, useState } from "react";
import type { CustomAttributeDef, Rfi } from "@/lib/aps/types";
import {
  BUILTIN_COLUMNS,
  formatCustomAttributeValue,
  getBuiltinValue,
} from "@/lib/rfi/format";
import { cn } from "@/lib/cn";

interface Props {
  rfis: Rfi[];
  customAttributes: CustomAttributeDef[];
  statusLabels?: Map<string, string>;
}

function resolveStatusLabel(r: Rfi, map?: Map<string, string>): Rfi {
  if (r.statusLabel) return r;
  const label = map?.get(r.status);
  return label ? { ...r, statusLabel: label } : r;
}

export function RfiGrid({ rfis, customAttributes, statusLabels }: Props) {
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const resolved = rfis.map((r) => resolveStatusLabel(r, statusLabels));
    if (!query.trim()) return resolved;
    const q = query.toLowerCase();
    return resolved.filter((r) => {
      const hay = [
        r.number,
        r.title,
        r.statusLabel ?? r.status,
        r.assignee?.name,
        r.question,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rfis, query, statusLabels]);

  return (
    <div className="mt-4 rounded-xl bg-white shadow-sm ring-1 ring-neutral-200">
      <div className="flex items-center justify-between gap-4 border-b border-neutral-200 px-4 py-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by number, title, status, assignee…"
          className="w-full max-w-sm rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-[color:var(--brand-primary)] focus:outline-none"
        />
        <p className="text-xs text-neutral-500">
          {rows.length.toLocaleString()} of {rfis.length.toLocaleString()}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-neutral-200 text-sm">
          <thead className="bg-neutral-50">
            <tr>
              {BUILTIN_COLUMNS.map((c) => (
                <th
                  key={c.id}
                  className="sticky top-0 bg-neutral-50 px-3 py-2 text-left font-medium text-neutral-700"
                  scope="col"
                >
                  {c.label}
                </th>
              ))}
              {customAttributes.map((a) => (
                <th
                  key={a.id}
                  className="sticky top-0 bg-neutral-50 px-3 py-2 text-left font-medium text-neutral-700"
                  scope="col"
                >
                  {a.name}
                  <span className="ml-1 text-[10px] font-normal text-neutral-400">
                    (custom)
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.map((r, i) => (
              <tr
                key={r.id}
                className={cn(i % 2 === 1 ? "bg-neutral-50/50" : "")}
              >
                {BUILTIN_COLUMNS.map((c) => (
                  <td key={c.id} className="px-3 py-2 align-top text-neutral-800">
                    {c.id === "title" ? (
                      <span className="font-medium">{getBuiltinValue(r, c.id)}</span>
                    ) : (
                      getBuiltinValue(r, c.id)
                    )}
                  </td>
                ))}
                {customAttributes.map((a) => (
                  <td key={a.id} className="px-3 py-2 align-top text-neutral-800">
                    {formatCustomAttributeValue(a, r.customAttributes[a.id])}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td
                  className="px-3 py-6 text-center text-neutral-500"
                  colSpan={BUILTIN_COLUMNS.length + customAttributes.length}
                >
                  No RFIs match this filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
