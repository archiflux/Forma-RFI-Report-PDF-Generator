"use client";

import { useMemo, useState } from "react";
import { isOverdue, statusLabel } from "@/lib/dashboard/aggregate";
import type { IssueRecord } from "@/lib/dashboard/types";
import { issueUrl } from "@/lib/aps/links";
import { FormaLink } from "./forma-link";

type Col = { key: string; label: string; get: (i: IssueRecord) => string };

const COLS: Col[] = [
  { key: "project", label: "Project", get: (i) => i.projectName },
  { key: "id", label: "#", get: (i) => i.displayId.padStart(6, "0") },
  { key: "title", label: "Title", get: (i) => i.title },
  { key: "type", label: "Type", get: (i) => i.subtypeName },
  { key: "status", label: "Status", get: (i) => i.status },
  { key: "assignee", label: "Assigned to", get: (i) => i.assignee?.name ?? "" },
  { key: "due", label: "Due", get: (i) => i.dueDate ?? "" },
  { key: "created", label: "Created", get: (i) => i.createdAt },
];

const PAGE = 50;

function day(iso?: string): string {
  return iso ? new Date(iso).toLocaleDateString("en-GB") : "";
}

export function IssueTable({ issues, now }: { issues: IssueRecord[]; now: Date }) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: "created", dir: -1 });
  const [page, setPage] = useState(0);
  const sorted = useMemo(() => {
    const col = COLS.find((c) => c.key === sort.key) ?? (COLS[0] as Col);
    return [...issues].sort((a, b) => col.get(a).localeCompare(col.get(b)) * sort.dir);
  }, [issues, sort]);
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE));
  const current = Math.min(page, pages - 1);
  const rows = sorted.slice(current * PAGE, current * PAGE + PAGE);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-xs">
          <thead className="text-left text-[color:var(--brand-muted)]">
            <tr>
              {COLS.map((c) => (
                <th key={c.key} className="py-1.5 pr-3 font-medium">
                  <button
                    type="button"
                    className="hover:text-[color:var(--brand-primary)]"
                    onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key ? (s.dir === 1 ? -1 : 1) : 1 }))}
                  >
                    {c.label}
                    {sort.key === c.key ? (sort.dir === 1 ? " ↑" : " ↓") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => {
              const late = isOverdue(i, now);
              return (
                <tr key={i.key} className="border-t border-[color:var(--brand-border)] align-top">
                  <td className="max-w-[12rem] truncate py-1.5 pr-3" title={i.projectName}>{i.projectName}</td>
                  <td className="py-1.5 pr-3 tabular-nums">{i.displayId}</td>
                  <td className="max-w-[22rem] py-1.5 pr-3" title={i.description}>
                    <FormaLink href={issueUrl(i.projectId, i.id)}>{i.title}</FormaLink>
                    {i.hasViewpoint ? <span className="ml-1.5 rounded bg-[color:var(--brand-canvas)] px-1 text-[10px] text-[color:var(--brand-muted)]">pinned</span> : null}
                  </td>
                  <td className="py-1.5 pr-3">{i.subtypeName}</td>
                  <td className="py-1.5 pr-3">{statusLabel(i.status)}</td>
                  <td className="py-1.5 pr-3">{i.assignee?.name ?? <span className="text-[color:var(--brand-muted)]">Unassigned</span>}</td>
                  <td className={`py-1.5 pr-3 tabular-nums ${late ? "font-semibold text-[color:var(--status-critical)]" : ""}`}>
                    {day(i.dueDate)}
                    {late ? " (overdue)" : ""}
                  </td>
                  <td className="py-1.5 pr-3 tabular-nums">{day(i.createdAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-[color:var(--brand-muted)]">
        <span>
          {sorted.length ? `${current * PAGE + 1}-${Math.min(sorted.length, (current + 1) * PAGE)} of ${sorted.length}` : "No issues match"}
        </span>
        <span className="flex gap-2">
          <button type="button" disabled={current === 0} onClick={() => setPage(current - 1)} className="underline disabled:opacity-40">Previous</button>
          <button type="button" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} className="underline disabled:opacity-40">Next</button>
        </span>
      </div>
    </div>
  );
}
