"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DashLayout, RegisterSort } from "@/lib/layout/layout";
import { activeSort, sortItems, visibleColumns, type RegisterColumn } from "@/lib/layout/register";
import { FormaLink } from "./forma-link";

const PAGE = 50;

// Register shared by every dashboard. Click any heading to sort by it (again
// to reverse); "Columns" picks which columns show and in what order. Both
// are part of the dashboard layout, so they carry into the PDF, shared links
// and saved project sets.
export function RegisterTable<T>({
  columns,
  items,
  rowKey,
  noun,
  layout,
  onLayoutChange,
  defaultSort,
}: {
  columns: Array<RegisterColumn<T>>;
  items: T[];
  rowKey: (t: T) => string;
  noun: string;
  layout: DashLayout;
  onLayoutChange: (l: DashLayout) => void;
  defaultSort: RegisterSort;
}) {
  const [page, setPage] = useState(0);
  const cols = useMemo(() => visibleColumns(columns, layout), [columns, layout]);
  const sort = activeSort(cols, layout, defaultSort);
  const sorted = useMemo(() => sortItems(items, columns, sort), [items, columns, sort]);
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE));
  const current = Math.min(page, pages - 1);
  const rows = sorted.slice(current * PAGE, current * PAGE + PAGE);

  const setSort = (col: string) =>
    onLayoutChange({ ...layout, sort: { col, dir: sort.col === col ? (sort.dir === 1 ? -1 : 1) : 1 } });

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <ColumnPicker all={columns} shown={cols} onChange={(ids) => onLayoutChange({ ...layout, columns: ids })} onReset={() => {
          const { columns: _drop, ...rest } = layout;
          void _drop;
          onLayoutChange(rest);
        }} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-xs">
          <thead className="text-left text-[color:var(--brand-muted)]">
            <tr>
              {cols.map((c) => (
                <th key={c.id} className="py-1.5 pr-3 font-medium" aria-sort={sort.col === c.id ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
                  <button type="button" className="hover:text-[color:var(--brand-primary)]" onClick={() => setSort(c.id)} title={`Sort by ${c.label}`}>
                    {c.label}
                    {sort.col === c.id ? (sort.dir === 1 ? " ↑" : " ↓") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={rowKey(t)} className="border-t border-[color:var(--brand-border)] align-top">
                {cols.map((c) => {
                  const text = c.value(t);
                  const href = c.href?.(t);
                  const badge = c.badge?.(t);
                  const alert = c.alert?.(t);
                  return (
                    <td key={c.id} className={`max-w-[22rem] py-1.5 pr-3 ${alert ? "font-semibold text-[color:var(--status-critical)]" : ""}`}>
                      {href ? <FormaLink href={href}>{text || "(untitled)"}</FormaLink> : <span className="line-clamp-3">{text}</span>}
                      {badge ? <span className="ml-1.5 rounded bg-[color:var(--brand-canvas)] px-1 text-[10px] text-[color:var(--brand-muted)]">{badge}</span> : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-[color:var(--brand-muted)]">
        <span>{sorted.length ? `${current * PAGE + 1}-${Math.min(sorted.length, (current + 1) * PAGE)} of ${sorted.length}` : `No ${noun} match`}</span>
        <span className="flex gap-2">
          <button type="button" disabled={current === 0} onClick={() => setPage(current - 1)} className="underline disabled:opacity-40">
            Previous
          </button>
          <button type="button" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} className="underline disabled:opacity-40">
            Next
          </button>
        </span>
      </div>
    </div>
  );
}

function ColumnPicker<T>({
  all,
  shown,
  onChange,
  onReset,
}: {
  all: Array<RegisterColumn<T>>;
  shown: Array<RegisterColumn<T>>;
  onChange: (ids: string[]) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const ids = shown.map((c) => c.id);
  const hidden = all.filter((c) => !ids.includes(c.id));
  const move = (i: number, by: number) => {
    const next = [...ids];
    const j = i + by;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j] as string, next[i] as string];
    onChange(next);
  };
  const btn = "rounded px-1.5 text-[color:var(--brand-muted)] hover:bg-[color:var(--brand-canvas)] hover:text-[color:var(--brand-primary)] disabled:opacity-30";

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-[color:var(--brand-border)] bg-white px-2.5 text-xs font-medium text-[color:var(--brand-secondary)] hover:border-[color:var(--brand-secondary)]"
      >
        Columns ({shown.length})
      </button>
      {open ? (
        <div className="absolute right-0 z-30 mt-1 max-h-[70vh] w-72 max-w-[80vw] overflow-y-auto rounded-xl border border-[color:var(--brand-border)] bg-white p-2 text-xs shadow-card">
          <p className="px-1.5 pb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--brand-muted)]">Shown, in order</p>
          <ul>
            {shown.map((c, i) => (
              <li key={c.id} className="flex items-center gap-1 rounded px-1.5 py-1 hover:bg-[color:var(--brand-canvas)]">
                <input type="checkbox" checked disabled={shown.length === 1} onChange={() => onChange(ids.filter((x) => x !== c.id))} aria-label={`Hide ${c.label}`} />
                <span className="min-w-0 flex-1 truncate">{c.label}</span>
                <button type="button" className={btn} disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${c.label} left`}>
                  ↑
                </button>
                <button type="button" className={btn} disabled={i === shown.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${c.label} right`}>
                  ↓
                </button>
              </li>
            ))}
          </ul>
          {hidden.length ? (
            <>
              <p className="mt-2 px-1.5 pb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--brand-muted)]">Add a column</p>
              <ul>
                {hidden.map((c) => (
                  <li key={c.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-[color:var(--brand-canvas)]">
                      <input type="checkbox" checked={false} onChange={() => onChange([...ids, c.id])} />
                      <span className="truncate">{c.label}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <button type="button" onClick={onReset} className="mt-2 w-full rounded px-1.5 py-1 text-left text-[color:var(--brand-secondary)] underline">
            Reset to default columns
          </button>
        </div>
      ) : null}
    </div>
  );
}
