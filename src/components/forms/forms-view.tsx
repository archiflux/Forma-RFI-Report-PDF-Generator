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
import type { ProjectLocation } from "@/lib/aps/project-location";
import { globePoints } from "@/lib/dashboard/globe";
import { ProjectGlobe } from "@/components/dashboard/project-globe";
import { FormsTable } from "./forms-table";
import { isFormOpen } from "@/lib/forms/normalise";
import { Treemap } from "@/components/charts/treemap";
import { Donut } from "@/components/charts/donut";
import { StackedArea } from "@/components/charts/stacked-area";
import { OpenClosedBars, type OpenClosedRow } from "@/components/charts/open-closed-bars";
import { OverdueTable } from "@/components/charts/overdue-table";
import { monthlyByCategory, topOverdue } from "@/lib/charts/series";
import { formUrl } from "@/lib/aps/links";
import { countBy } from "@/lib/dashboard/aggregate";

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

export function FormsView({
  dataset,
  now,
  locations,
}: {
  dataset: FormsDataset;
  now: Date;
  locations?: Record<string, ProjectLocation | null>;
}) {
  const [f, setF] = useState<FormFilters>(EMPTY_FORM_FILTERS);
  const all = dataset.forms;
  const forms = useMemo(() => applyFormFilters(all, f), [all, f]);
  const customs = useMemo(() => all.map((x) => x.custom), [all]);
  const donut = useMemo(() => countBy(forms, (x) => formStatusLabel(x.status), 6), [forms]);
  const tree = useMemo(() => countBy(forms, (x) => x.templateName, 20), [forms]);
  const statusMonths = useMemo(() => monthlyByCategory(forms, (x) => x.formDate ?? x.createdAt, (x) => formStatusLabel(x.status)), [forms]);
  const overdue = useMemo(() => topOverdue(forms, isFormOpen, (x) => x.dueDate, now), [forms, now]);
  const projectRows = useMemo(() => {
    const m = new Map<string, OpenClosedRow>();
    const today = now.toISOString().slice(0, 10);
    for (const x of forms) {
      const r = m.get(x.projectId) ?? { id: x.projectId, name: x.projectName, open: 0, closed: 0, overdue: 0 };
      if (isFormOpen(x)) {
        r.open++;
        if (x.dueDate && x.dueDate.slice(0, 10) < today) r.overdue++;
      } else r.closed++;
      m.set(x.projectId, r);
    }
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name, "en-GB", { numeric: true, sensitivity: "base" }));
  }, [forms, now]);
  const set = (patch: Partial<FormFilters>) => setF((cur) => ({ ...cur, ...patch }));

  const k = useMemo(() => formKpis(forms, now), [forms, now]);
  const { byCreator, overdueByTemplate, trend } = useMemo(() => formBreakdowns(forms, now), [forms, now]);

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

      {locations ? (
        <Panel title="Projects on the map">
          <ProjectGlobe
            noun="forms"
            {...globePoints(forms, dataset.projects, locations, isFormOpen)}
            selected={f.projectIds}
            onSelect={(id) => set({ projectIds: toggle(f.projectIds, id) })}
          />
        </Panel>
      ) : null}

      <Panel title="Forms by template (click to filter)">
        <Treemap data={tree} selected={f.templates} onSelect={(v) => set({ templates: toggle(f.templates, v) })} />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <Panel title="Forms by status">
          <Donut data={donut} centreLabel="forms" />
        </Panel>
        <Panel title="Open and closed by project (click a project to filter)">
          <OpenClosedBars rows={projectRows} selected={f.projectIds} onSelect={(id) => set({ projectIds: toggle(f.projectIds, id) })} />
        </Panel>
        <Panel title="Forms over time by status (form date)">
          <StackedArea rows={statusMonths.rows} categories={statusMonths.categories} />
        </Panel>
        <Panel title="Forms per month (by form date)">
          <TrendChart data={trend} series={[{ key: "count", label: "Forms", colour: "var(--series-1)" }]} ariaLabel="Forms per month" />
        </Panel>
        <div className="lg:col-span-2">
          <Panel title="Top 10 most overdue open forms">
            <OverdueTable
              ownerLabel="Created by"
              rows={overdue.map(({ item, due, daysOverdue }) => ({
                key: item.key,
                title: item.name,
                href: formUrl(item.projectId, item.templateId, item.id),
                project: item.projectName,
                number: item.formNum,
                ...(item.createdBy ? { owner: item.createdBy } : {}),
                due,
                daysOverdue,
              }))}
            />
          </Panel>
        </div>
        <Panel title="Overdue forms by template">
          <BarList data={overdueByTemplate} />
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
