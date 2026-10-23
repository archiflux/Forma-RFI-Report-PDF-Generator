"use client";

import { useMemo, useState } from "react";
import { sortRows } from "@/lib/generic/aggregate";
import type { BaseRecord, GenericConfig } from "@/lib/generic/types";
import { FormaLink } from "@/components/dashboard/forma-link";

const PAGE = 50;

export function GenericTable<T extends BaseRecord>({ cfg, items, now }: { cfg: GenericConfig<T>; items: T[]; now: Date }) {
  const [sort, setSort] = useState(cfg.defaultSort);
  const [page, setPage] = useState(0);
  const sorted = useMemo(() => sortRows(items, cfg, sort.column, sort.dir, now), [items, cfg, sort, now]);
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE));
  const current = Math.min(page, pages - 1);
  const rows = sorted.slice(current * PAGE, current * PAGE + PAGE);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-xs">
          <thead className="text-left text-[color:var(--brand-muted)]">
            <tr>
              {cfg.columns.map((c, i) => (
                <th key={c.label} className="py-1.5 pr-3 font-medium">
                  <button
                    type="button"
                    className="hover:text-[color:var(--brand-primary)]"
                    onClick={() => setSort((s) => ({ column: i, dir: s.column === i ? (s.dir === 1 ? -1 : 1) : 1 }))}
                  >
                    {c.label}
                    {sort.column === i ? (sort.dir === 1 ? " ↑" : " ↓") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.key} className="border-t border-[color:var(--brand-border)] align-top">
                {cfg.columns.map((c, i) => {
                  const text = c.value(t, now);
                  const href = i === 0 ? cfg.linkOf(t) : undefined;
                  const alert = c.alert?.(t, now);
                  return (
                    <td key={c.label} className={`max-w-[22rem] py-1.5 pr-3 ${alert ? "font-semibold text-[color:var(--status-critical)]" : ""}`}>
                      {href ? <FormaLink href={href}>{text || "(untitled)"}</FormaLink> : text}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-[color:var(--brand-muted)]">
        <span>{sorted.length ? `${current * PAGE + 1}-${Math.min(sorted.length, (current + 1) * PAGE)} of ${sorted.length}` : `No ${cfg.noun} match`}</span>
        <span className="flex gap-2">
          <button type="button" disabled={current === 0} onClick={() => setPage(current - 1)} className="underline disabled:opacity-40">Previous</button>
          <button type="button" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} className="underline disabled:opacity-40">Next</button>
        </span>
      </div>
    </div>
  );
}
