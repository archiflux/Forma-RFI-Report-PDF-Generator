"use client";

import { useMemo, useState } from "react";
import { formStatusLabel } from "@/lib/forms/normalise";
import type { FormsDataset } from "@/lib/forms/types";
import { applyFormFilters, EMPTY_FORM_FILTERS, formBreakdowns, formKpis, type FormFilters } from "@/lib/forms/aggregate";
import { buildFormsReport } from "@/lib/forms/report";
import { PdfButton } from "@/components/dashboard/pdf-button";
import { CustomFieldFilter } from "@/components/dashboard/custom-field-filter";
import { DateRangeFilter } from "@/components/dashboard/date-range-filter";
import { BarList } from "@/components/dashboard/bar-list";
import { MultiSelect } from "@/components/dashboard/multi-select";
import { Panel } from "@/components/dashboard/panel";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { FormsTable } from "./forms-table";

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

export function FormsView({ dataset, now }: { dataset: FormsDataset; now: Date }) {
  const [f, setF] = useState<FormFilters>(EMPTY_FORM_FILTERS);
  const all = dataset.forms;
  const forms = useMemo(() => applyFormFilters(all, f), [all, f]);
  const customs = useMemo(() => all.map((x) => x.custom), [all]);
  const set = (patch: Partial<FormFilters>) => setF((cur) => ({ ...cur, ...patch }));

  const k = useMemo(() => formKpis(forms, now), [forms, now]);
  const { byTemplate, byStatus, byCreator, byProject, overdueByTemplate, trend } = useMemo(() => formBreakdowns(forms, now), [forms, now]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <MultiSelect label="Project" options={dataset.projects.filter((p) => p.formCount).map((p) => ({ value: p.id, label: p.name }))} value={f.projectIds} onChange={(v) => set({ projectIds: v })} />
        <MultiSelect label="Template" options={opts(all.map((x) => x.templateName))} value={f.templates} onChange={(v) => set({ templates: v })} />
        <MultiSelect label="Status" options={opts(all.map((x) => x.status), formStatusLabel)} value={f.statuses} onChange={(v) => set({ statuses: v })} />
        <MultiSelect label="Created by" options={opts(all.map((x) => x.createdBy ?? "Unknown"))} value={f.creators} onChange={(v) => set({ creators: v })} />
        <DateRangeFilter label="Form date" from={f.from} to={f.to} onChange={(r) => set({ from: r.from, to: r.to })} />
        <CustomFieldFilter customs={customs} value={f.custom} onChange={(v) => set({ custom: v })} />
        <input
          type="search"
          placeholder="Search number, name, template"
          value={f.search}
          onChange={(e) => set({ search: e.target.value })}
          className="min-h-9 w-56 rounded-lg border border-[color:var(--brand-border)] bg-white px-3 text-xs"
        />
        <div className="ml-auto">
          <PdfButton
            build={(includeRegister, maxRegisterRows) =>
              buildFormsReport({
                forms,
                filters: f,
                projectNames: Object.fromEntries(dataset.projects.map((p) => [p.id, p.name])),
                now,
                includeRegister,
                maxRegisterRows,
              })
            }
          />
        </div>
        {forms.length !== all.length ? (
          <button type="button" className="text-xs text-[color:var(--brand-secondary)] underline" onClick={() => setF(EMPTY_FORM_FILTERS)}>
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
