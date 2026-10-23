"use client";

import { useMemo, useState } from "react";
import { formStatusLabel, isFormOverdue } from "@/lib/forms/normalise";
import type { FormRecord } from "@/lib/forms/types";

type Col = { key: string; label: string; get: (f: FormRecord) => string };

const COLS: Col[] = [
  { key: "project", label: "Project", get: (f) => f.projectName },
  { key: "num", label: "#", get: (f) => f.formNum.padStart(6, "0") },
  { key: "name", label: "Name", get: (f) => f.name },
  { key: "template", label: "Template", get: (f) => f.templateName },
  { key: "status", label: "Status", get: (f) => f.status },
  { key: "createdBy", label: "Created by", get: (f) => f.createdBy ?? "" },
  { key: "formDate", label: "Form date", get: (f) => f.formDate ?? "" },
  { key: "due", label: "Due", get: (f) => f.dueDate ?? "" },
];

const PAGE = 50;

function day(iso?: string): string {
  return iso ? new Date(iso).toLocaleDateString("en-GB") : "";
}

export function FormsTable({ forms, now }: { forms: FormRecord[]; now: Date }) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: "formDate", dir: -1 });
  const [page, setPage] = useState(0);
  const sorted = useMemo(() => {
    const col = COLS.find((c) => c.key === sort.key) ?? (COLS[0] as Col);
    return [...forms].sort((a, b) => col.get(a).localeCompare(col.get(b)) * sort.dir);
  }, [forms, sort]);
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
            {rows.map((f) => {
              const late = isFormOverdue(f, now);
              return (
                <tr key={f.key} className="border-t border-[color:var(--brand-border)] align-top">
                  <td className="max-w-[12rem] truncate py-1.5 pr-3" title={f.projectName}>{f.projectName}</td>
                  <td className="py-1.5 pr-3 tabular-nums">{f.formNum}</td>
                  <td className="max-w-[20rem] py-1.5 pr-3 font-medium text-[color:var(--brand-primary)]">{f.name}</td>
                  <td className="py-1.5 pr-3">{f.templateName}</td>
                  <td className="py-1.5 pr-3">{formStatusLabel(f.status)}</td>
                  <td className="py-1.5 pr-3">{f.createdBy ?? ""}</td>
                  <td className="py-1.5 pr-3 tabular-nums">{day(f.formDate)}</td>
                  <td className={`py-1.5 pr-3 tabular-nums ${late ? "font-semibold text-[color:var(--status-critical)]" : ""}`}>
                    {day(f.dueDate)}
                    {late ? " (overdue)" : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-[color:var(--brand-muted)]">
        <span>{sorted.length ? `${current * PAGE + 1}-${Math.min(sorted.length, (current + 1) * PAGE)} of ${sorted.length}` : "No forms match"}</span>
        <span className="flex gap-2">
          <button type="button" disabled={current === 0} onClick={() => setPage(current - 1)} className="underline disabled:opacity-40">Previous</button>
          <button type="button" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} className="underline disabled:opacity-40">Next</button>
        </span>
      </div>
    </div>
  );
}
