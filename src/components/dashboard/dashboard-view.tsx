"use client";

import { useMemo, useState } from "react";
import {
  ageing,
  applyFilters,
  countBy,
  isOutstanding,
  kpis,
  monthlyTrend,
  statusByProject,
  statusLabel,
} from "@/lib/dashboard/aggregate";
import { EMPTY_FILTERS, type DashboardDataset, type DashboardFilters } from "@/lib/dashboard/types";
import { BarList } from "./bar-list";
import { IssueTable } from "./issue-table";
import { KpiTiles } from "./kpi-tiles";
import { MultiSelect } from "./multi-select";
import { ProjectStatus, StatusLegend } from "./project-status";
import { TrendChart } from "./trend-chart";

function Panel({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[color:var(--brand-border)] bg-white p-4 shadow-card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[color:var(--brand-primary)]">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function opts(values: string[], fmt: (v: string) => string = (v) => v) {
  return [...new Set(values)].sort().map((v) => ({ value: v, label: fmt(v) }));
}

function toggle(list: string[], v: string): string[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

// Renders a DashboardDataset. Used by the live (signed-in) dashboard and by
// the public snapshot viewer, so the two always look identical.
export function DashboardView({ dataset, now }: { dataset: DashboardDataset; now: Date }) {
  const [f, setF] = useState<DashboardFilters>(EMPTY_FILTERS);
  const all = dataset.issues;
  const issues = useMemo(() => applyFilters(all, f), [all, f]);
  const set = (patch: Partial<DashboardFilters>) => setF((cur) => ({ ...cur, ...patch }));

  const k = useMemo(() => kpis(issues, now), [issues, now]);
  const byType = useMemo(() => countBy(issues, (i) => i.typeName), [issues]);
  const byCause = useMemo(() => countBy(issues, (i) => i.rootCause), [issues]);
  const byAssignee = useMemo(() => countBy(issues.filter(isOutstanding), (i) => i.assignee?.name ?? "Unassigned"), [issues]);
  const byStatus = useMemo(() => countBy(issues, (i) => statusLabel(i.status), 12), [issues]);
  const projects = useMemo(() => statusByProject(issues, now), [issues, now]);
  const trend = useMemo(() => monthlyTrend(issues), [issues]);
  const ages = useMemo(() => ageing(issues, now), [issues, now]);
  const filtered = issues.length !== all.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <MultiSelect label="Project" options={dataset.projects.map((p) => ({ value: p.id, label: p.name }))} value={f.projectIds} onChange={(v) => set({ projectIds: v })} />
        <MultiSelect label="Status" options={opts(all.map((i) => i.status), statusLabel)} value={f.statuses} onChange={(v) => set({ statuses: v })} />
        <MultiSelect label="Type" options={opts(all.map((i) => i.typeName))} value={f.types} onChange={(v) => set({ types: v })} />
        <MultiSelect label="Assignee" options={opts(all.map((i) => i.assignee?.name ?? "Unassigned"))} value={f.assignees} onChange={(v) => set({ assignees: v })} />
        <label className="flex min-h-9 items-center gap-1 rounded-lg border border-[color:var(--brand-border)] bg-white px-2 text-xs">
          <span className="text-[color:var(--brand-muted)]">Created</span>
          <input type="date" value={f.createdFrom ?? ""} onChange={(e) => set({ createdFrom: e.target.value || undefined })} className="text-xs" />
          <span>to</span>
          <input type="date" value={f.createdTo ?? ""} onChange={(e) => set({ createdTo: e.target.value || undefined })} className="text-xs" />
        </label>
        <input
          type="search"
          placeholder="Search title, #, location"
          value={f.search}
          onChange={(e) => set({ search: e.target.value })}
          className="min-h-9 w-56 rounded-lg border border-[color:var(--brand-border)] bg-white px-3 text-xs"
        />
        {filtered ? (
          <button type="button" className="text-xs text-[color:var(--brand-secondary)] underline" onClick={() => setF(EMPTY_FILTERS)}>
            Reset filters ({issues.length} of {all.length})
          </button>
        ) : null}
      </div>

      <KpiTiles k={k} />

      <Panel title="Status by project" action={<StatusLegend />}>
        <ProjectStatus rows={projects} />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Created vs closed per month">
          <TrendChart data={trend} />
        </Panel>
        <Panel title="Age of outstanding issues">
          <BarList data={ages} />
        </Panel>
        <Panel title="Issues by type (click to filter)">
          <BarList data={byType} selected={f.types} onSelect={(v) => set({ types: toggle(f.types, v) })} />
        </Panel>
        <Panel title="Issues by status">
          <BarList data={byStatus} />
        </Panel>
        <Panel title="Open workload by assignee (click to filter)">
          <BarList data={byAssignee} selected={f.assignees} onSelect={(v) => set({ assignees: toggle(f.assignees, v) })} />
        </Panel>
        <Panel title="Issues by root cause">
          <BarList data={byCause} />
        </Panel>
      </div>

      <Panel title={`Issue register (${issues.length})`}>
        <IssueTable issues={issues} now={now} />
      </Panel>
    </div>
  );
}
