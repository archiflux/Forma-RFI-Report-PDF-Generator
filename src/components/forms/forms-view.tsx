"use client";

import { useMemo, useState } from "react";
import { countBy, monthlyCounts } from "@/lib/dashboard/aggregate";
import { formStatusLabel, isFormOpen, isFormOverdue } from "@/lib/forms/normalise";
import type { FormRecord, FormsDataset } from "@/lib/forms/types";
import { BarList } from "@/components/dashboard/bar-list";
import { MultiSelect } from "@/components/dashboard/multi-select";
import { Panel } from "@/components/dashboard/panel";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { FormsTable } from "./forms-table";

interface Filters {
  projectIds: string[];
  templates: string[];
  statuses: string[];
  search: string;
}

const EMPTY: Filters = { projectIds: [], templates: [], statuses: [], search: "" };

function opts(values: string[], fmt: (v: string) => string = (v) => v) {
  return [...new Set(values)].sort().map((v) => ({ value: v, label: fmt(v) }));
}

function toggle(list: string[], v: string): string[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

function Tile({ label, value, alert }: { label: string; value: number; alert?: boolean }) {
  return (
    <div className="rounded-xl border border-[color:var(--brand-border)] bg-white p-4 shadow-card">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-muted)]">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${alert ? "text-[color:var(--status-critical)]" : "text-[color:var(--brand-primary)]"}`}>
        {value}
      </p>
    </div>
  );
}

export function applyFormFilters(forms: FormRecord[], f: Filters): FormRecord[] {
  const q = f.search.trim().toLowerCase();
  return forms.filter(
    (x) =>
      (!f.projectIds.length || f.projectIds.includes(x.projectId)) &&
      (!f.templates.length || f.templates.includes(x.templateName)) &&
      (!f.statuses.length || f.statuses.includes(x.status)) &&
      (!q || `${x.formNum} ${x.name} ${x.templateName}`.toLowerCase().includes(q)),
  );
}

export function FormsView({ dataset, now }: { dataset: FormsDataset; now: Date }) {
  const [f, setF] = useState<Filters>(EMPTY);
  const all = dataset.forms;
  const forms = useMemo(() => applyFormFilters(all, f), [all, f]);
  const set = (patch: Partial<Filters>) => setF((cur) => ({ ...cur, ...patch }));

  const k = useMemo(() => {
    const in7 = new Date(now.getTime() + 7 * 86_400_000).toISOString().slice(0, 10);
    const today = now.toISOString().slice(0, 10);
    return {
      total: forms.length,
      open: forms.filter(isFormOpen).length,
      overdue: forms.filter((x) => isFormOverdue(x, now)).length,
      dueSoon: forms.filter((x) => isFormOpen(x) && x.dueDate && x.dueDate.slice(0, 10) >= today && x.dueDate.slice(0, 10) <= in7).length,
      templates: new Set(forms.map((x) => x.templateName)).size,
    };
  }, [forms, now]);
  const byTemplate = useMemo(() => countBy(forms, (x) => x.templateName), [forms]);
  const byStatus = useMemo(() => countBy(forms, (x) => formStatusLabel(x.status), 12), [forms]);
  const byCreator = useMemo(() => countBy(forms, (x) => x.createdBy ?? "Unknown"), [forms]);
  const byProject = useMemo(() => countBy(forms, (x) => x.projectName, 15), [forms]);
  const overdueByTemplate = useMemo(() => countBy(forms.filter((x) => isFormOverdue(x, now)), (x) => x.templateName), [forms, now]);
  const trend = useMemo(() => monthlyCounts(forms, (x) => x.formDate ?? x.createdAt), [forms]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <MultiSelect label="Project" options={dataset.projects.filter((p) => p.formCount).map((p) => ({ value: p.id, label: p.name }))} value={f.projectIds} onChange={(v) => set({ projectIds: v })} />
        <MultiSelect label="Template" options={opts(all.map((x) => x.templateName))} value={f.templates} onChange={(v) => set({ templates: v })} />
        <MultiSelect label="Status" options={opts(all.map((x) => x.status), formStatusLabel)} value={f.statuses} onChange={(v) => set({ statuses: v })} />
        <input
          type="search"
          placeholder="Search number, name, template"
          value={f.search}
          onChange={(e) => set({ search: e.target.value })}
          className="min-h-9 w-56 rounded-lg border border-[color:var(--brand-border)] bg-white px-3 text-xs"
        />
        {forms.length !== all.length ? (
          <button type="button" className="text-xs text-[color:var(--brand-secondary)] underline" onClick={() => setF(EMPTY)}>
            Reset filters ({forms.length} of {all.length})
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Tile label="Forms" value={k.total} />
        <Tile label="Open" value={k.open} />
        <Tile label="Overdue" value={k.overdue} alert={k.overdue > 0} />
        <Tile label="Due in 7 days" value={k.dueSoon} />
        <Tile label="Templates in use" value={k.templates} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Forms per month (by form date)">
          <TrendChart data={trend} series={[{ key: "count", label: "Forms", colour: "var(--series-1)" }]} ariaLabel="Forms per month" />
        </Panel>
        <Panel title="Forms by template (click to filter)">
          <BarList data={byTemplate} selected={f.templates} onSelect={(v) => set({ templates: toggle(f.templates, v) })} />
        </Panel>
        <Panel title="Forms by status">
          <BarList data={byStatus} />
        </Panel>
        <Panel title="Overdue forms by template">
          <BarList data={overdueByTemplate} />
        </Panel>
        <Panel title="Forms by project">
          <BarList data={byProject} />
        </Panel>
        <Panel title="Forms by creator">
          <BarList data={byCreator} />
        </Panel>
      </div>

      <Panel title={`Form register (${forms.length})`}>
        <FormsTable forms={forms} now={now} />
      </Panel>
    </div>
  );
}
