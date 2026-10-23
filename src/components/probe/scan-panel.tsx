"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { ApsClient } from "@/lib/aps/client";
import { SCAN_TOOLS, scanProject, type ScanCell, type ScanTool } from "@/lib/aps/scan";
import type { Project } from "@/lib/aps/types";

type Row = { project: Project; cells: Record<ScanTool, ScanCell> };

function show(c: ScanCell): string {
  return typeof c === "number" ? String(c) : c;
}

// Counts per tool per project, for deciding which dashboards are worth
// building or using. Three projects at a time to stay under rate limits.
export function ScanPanel({ client, projects }: { client: ApsClient; projects: Project[] }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);

  async function run() {
    setRunning(true);
    setRows([]);
    const out: Row[] = [];
    for (let i = 0; i < projects.length; i += 3) {
      const batch = await Promise.all(projects.slice(i, i + 3).map(async (project) => ({ project, cells: await scanProject(client, project.id) })));
      out.push(...batch);
      setRows([...out]);
    }
    setRunning(false);
  }

  const totals = Object.fromEntries(
    SCAN_TOOLS.map((t) => [t, rows.reduce((s, r) => s + (typeof r.cells[t] === "number" ? (r.cells[t] as number) : 0), 0)]),
  ) as Record<ScanTool, number>;
  const withData = Object.fromEntries(
    SCAN_TOOLS.map((t) => [t, rows.filter((r) => typeof r.cells[t] === "number" && (r.cells[t] as number) > 0).length]),
  ) as Record<ScanTool, number>;

  return (
    <section className="space-y-3 rounded-2xl border border-[color:var(--brand-border)] bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto">
          <h3 className="text-sm font-semibold text-[color:var(--brand-primary)]">Data availability across my projects</h3>
          <p className="text-xs text-[color:var(--brand-muted)]">
            Counts the records each tool holds in each of your {projects.length} projects. &quot;off&quot; means the tool isn&apos;t switched on.
          </p>
        </div>
        <Button size="sm" onClick={run} disabled={running || !projects.length}>
          {running ? `Scanning ${rows.length}/${projects.length}…` : "Scan all projects"}
        </Button>
        {rows.length && !running ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              const lines = [`| Project | ${SCAN_TOOLS.join(" | ")} |`, `|---|${SCAN_TOOLS.map(() => "---").join("|")}|`];
              for (const r of rows) lines.push(`| ${r.project.name} | ${SCAN_TOOLS.map((t) => show(r.cells[t])).join(" | ")} |`);
              lines.push(`| Projects with data | ${SCAN_TOOLS.map((t) => withData[t]).join(" | ")} |`);
              await navigator.clipboard.writeText(lines.join("\n")).catch(() => undefined);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? "Copied" : "Copy table"}
          </Button>
        ) : null}
      </div>
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-xs">
            <thead className="text-left text-[color:var(--brand-muted)]">
              <tr>
                <th className="py-1.5 pr-3 font-medium">Project</th>
                {SCAN_TOOLS.map((t) => <th key={t} className="py-1.5 pr-3 text-right font-medium">{t}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.project.id} className="border-t border-[color:var(--brand-border)]">
                  <td className="py-1.5 pr-3">{r.project.name}</td>
                  {SCAN_TOOLS.map((t) => {
                    const c = r.cells[t];
                    return (
                      <td key={t} className={`py-1.5 pr-3 text-right tabular-nums ${typeof c === "number" && c > 0 ? "font-semibold" : "text-[color:var(--brand-muted)]"}`}>
                        {show(c)}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {!running ? (
                <tr className="border-t-2 border-[color:var(--brand-border)] font-semibold">
                  <td className="py-1.5 pr-3">Total (projects with data)</td>
                  {SCAN_TOOLS.map((t) => (
                    <td key={t} className="py-1.5 pr-3 text-right tabular-nums">{totals[t]} ({withData[t]})</td>
                  ))}
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
