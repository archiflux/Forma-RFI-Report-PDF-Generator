"use client";

import { Open3DButton } from "@/components/three-d/open-3d-button";
import { issuesUniverse } from "@/lib/three-d/things";
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
  BUCKET_LABEL,
  STATUS_BUCKETS,
  statusBucket,
  isOverdue,
} from "@/lib/dashboard/aggregate";
import { EMPTY_FILTERS, type DashboardDataset, type DashboardFilters } from "@/lib/dashboard/types";
import { BarList } from "./bar-list";
import { RegisterTable } from "./register-table";
import { Hideable } from "./panel";
import { PanelLayoutContext, useViewLayout } from "./layout-context";
import { issueColumns, ISSUE_DEFAULT_SORT } from "@/lib/dashboard/register";
import { applyLayoutToReport, type DashLayout } from "@/lib/layout/layout";
import { KpiTiles } from "./kpi-tiles";
import { MultiSelect } from "./multi-select";
import type { ProjectLocation } from "@/lib/aps/project-location";
import { globePoints } from "@/lib/dashboard/globe";
import { ProjectGlobe } from "@/components/dashboard/project-globe";
import { Panel } from "./panel";
import { Treemap } from "@/components/charts/treemap";
import { Donut } from "@/components/charts/donut";
import { Gauge } from "@/components/charts/gauge";
import { StackedArea } from "@/components/charts/stacked-area";
import { OverdueTable } from "@/components/charts/overdue-table";
import { monthlyByCategory, topOverdue } from "@/lib/charts/series";
import { issueUrl } from "@/lib/aps/links";
import { BUCKET_COLOUR } from "./project-status";
import { CustomFieldFilter } from "./custom-field-filter";
import { DateRangeFilter } from "./date-range-filter";
import { PdfButton } from "./pdf-button";
import { buildIssuesReport } from "@/lib/dashboard/report";
import { ProjectStatus, StatusLegend } from "./project-status";
import { TrendChart } from "./trend-chart";

function opts(values: string[], fmt: (v: string) => string = (v) => v) {
  return [...new Set(values)].sort().map((v) => ({ value: v, label: fmt(v) }));
}

function toggle(list: string[], v: string): string[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

// Renders a DashboardDataset. Used by the live (signed-in) dashboard and by
// the public snapshot viewer, so the two always look identical.
// `locations` (project id -> coordinates) turns on the project globe; the
// public viewer leaves it out.
export function DashboardView({
  dataset,
  now,
  locations,
  layout: layoutIn,
  onLayoutChange,
}: {
  dataset: DashboardDataset;
  now: Date;
  locations?: Record<string, ProjectLocation | null>;
  layout?: DashLayout;
  onLayoutChange?: (l: DashLayout) => void;
}) {
  const { layout, setLayout, panels } = useViewLayout(layoutIn, onLayoutChange);
  const [f, setF] = useState<DashboardFilters>(EMPTY_FILTERS);
  const all = dataset.issues;
  const issues = useMemo(() => applyFilters(all, f), [all, f]);
  const customs = useMemo(() => all.map((i) => i.custom), [all]);
  const set = (patch: Partial<DashboardFilters>) => setF((cur) => ({ ...cur, ...patch }));

  const k = useMemo(() => kpis(issues, now), [issues, now]);
  const byType = useMemo(() => countBy(issues, (i) => i.typeName, 16), [issues]);
  const overdueByAssignee = useMemo(
    () => countBy(issues.filter((i) => isOverdue(i, now)), (i) => i.assignee?.name ?? "Unassigned"),
    [issues, now],
  );
  const byCause = useMemo(() => countBy(issues, (i) => i.rootCause), [issues]);
  const byAssignee = useMemo(() => countBy(issues.filter(isOutstanding), (i) => i.assignee?.name ?? "Unassigned"), [issues]);
  const byStatus = useMemo(() => countBy(issues, (i) => statusLabel(i.status), 6), [issues]);
  const byBucketMonth = useMemo(
    () => monthlyByCategory(issues, (i) => i.createdAt, (i) => BUCKET_LABEL[statusBucket(i.status)]),
    [issues],
  );
  const bucketOrder = STATUS_BUCKETS.map((b) => BUCKET_LABEL[b]).filter((l) => byBucketMonth.categories.includes(l));
  const overdue = useMemo(() => topOverdue(issues, isOutstanding, (i) => i.dueDate, now), [issues, now]);
  const projects = useMemo(() => statusByProject(issues, now), [issues, now]);
  const trend = useMemo(() => monthlyTrend(issues), [issues]);
  const ages = useMemo(() => ageing(issues, now), [issues, now]);
  const byLocation = useMemo(() => countBy(issues, (i) => i.location ?? "Not set"), [issues]);
  // Custom fields present in the data, most-populated first.
  const customFields = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of all) for (const k of Object.keys(i.custom)) m.set(k, (m.get(k) ?? 0) + 1);
    return [...m.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  }, [all]);
  const [field, setField] = useState("");
  const activeField = field || customFields[0]?.label || "";
  const byCustom = useMemo(
    () => (activeField ? countBy(issues, (i) => i.custom[activeField] ?? "Not set") : []),
    [issues, activeField],
  );
  const filtered = issues.length !== all.length;
  const columns = useMemo(() => issueColumns(all, now), [all, now]);

  return (
    <PanelLayoutContext.Provider value={panels}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <MultiSelect label="Project" options={dataset.projects.map((p) => ({ value: p.id, label: p.name }))} value={f.projectIds} onChange={(v) => set({ projectIds: v })} />
          <MultiSelect label="Status" options={opts(all.map((i) => i.status), statusLabel)} value={f.statuses} onChange={(v) => set({ statuses: v })} />
          <MultiSelect label="Type" options={opts(all.map((i) => i.typeName))} value={f.types} onChange={(v) => set({ types: v })} />
          <MultiSelect label="Assignee" options={opts(all.map((i) => i.assignee?.name ?? "Unassigned"))} value={f.assignees} onChange={(v) => set({ assignees: v })} />
          <DateRangeFilter label="Created" from={f.createdFrom} to={f.createdTo} onChange={(r) => set({ createdFrom: r.from, createdTo: r.to })} />
          <CustomFieldFilter customs={customs} value={f.custom} onChange={(v) => set({ custom: v })} />
          <input
            type="search"
            placeholder="Search title, #, location"
            value={f.search}
            onChange={(e) => set({ search: e.target.value })}
            className="min-h-9 w-56 rounded-lg border border-[color:var(--brand-border)] bg-white px-3 text-xs"
          />
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Open3DButton build={() => issuesUniverse(issues, now, locations, dataset.title ?? "Issues")} />
            <PdfButton
              build={(includeRegister, maxRegisterRows) =>
                applyLayoutToReport(
                  buildIssuesReport({
                    issues,
                    filters: f,
                    projectNames: Object.fromEntries(dataset.projects.map((p) => [p.id, p.name])),
                    projectCount: new Set(issues.map((i) => i.projectId)).size,
                    now,
                    includeRegister,
                    maxRegisterRows,
                    ...(dataset.title ? { title: dataset.title } : {}),
                    layout,
                  }),
                  layout,
                )
              }
            />
          </div>
          {filtered ? (
            <button type="button" className="text-xs text-[color:var(--brand-secondary)] underline" onClick={() => setF(EMPTY_FILTERS)}>
              Reset filters ({issues.length} of {all.length})
            </button>
          ) : null}
        </div>

        <Hideable id="kpis" title="Key figures">
          <KpiTiles k={k} />
        </Hideable>

        {locations ? (
          <Panel id="map" title="Projects on the map">
            <ProjectGlobe
              noun="issues"
              {...globePoints(issues, dataset.projects, locations, isOutstanding)}
              selected={f.projectIds}
              onSelect={(id) => set({ projectIds: toggle(f.projectIds, id) })}
            />
          </Panel>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-3 [&>*]:min-w-0">
          <Panel id="avg-close" title="Average days to close">
            <Gauge value={k.avgDaysToClose} unit="days, created to closed" caption="Average days to close" />
          </Panel>
          <div className="lg:col-span-2">
            <Panel id="status" title="Issues by status">
              <Donut data={byStatus} centreLabel="issues" />
            </Panel>
          </div>
        </div>

        <Panel id="type" title="Issues by type (click to filter)">
          <Treemap data={byType} selected={f.types} onSelect={(v) => set({ types: toggle(f.types, v) })} />
        </Panel>

        <Panel id="status-by-project" title="Status by project" action={<StatusLegend />}>
          <ProjectStatus rows={projects} />
        </Panel>

        <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
          <Panel id="status-month" title="Issues raised per month, by status today">
            <StackedArea
              rows={byBucketMonth.rows}
              categories={bucketOrder}
              colours={Object.fromEntries(STATUS_BUCKETS.map((b) => [BUCKET_LABEL[b], BUCKET_COLOUR[b]]))}
            />
          </Panel>
          <Panel id="trend" title="Created vs closed per month">
            <TrendChart data={trend} />
          </Panel>
          <div className="lg:col-span-2">
            <Panel id="overdue" title="Top 10 most overdue open issues">
              <OverdueTable
                ownerLabel="Assigned to"
                rows={overdue.map(({ item, due, daysOverdue }) => ({
                  key: item.key,
                  title: item.title,
                  ...(item.projectId.startsWith("demo-") ? {} : { href: issueUrl(item.projectId, item.id) }),
                  project: item.projectName,
                  number: item.displayId,
                  owner: item.assignee?.name ?? "Unassigned",
                  due,
                  daysOverdue,
                }))}
              />
            </Panel>
          </div>
          <Panel id="ages" title="Age of outstanding issues">
            <BarList data={ages} />
          </Panel>
          <Panel id="overdue-assignee" title="Overdue open issues by assignee (click to filter)">
            <BarList data={overdueByAssignee} selected={f.assignees} onSelect={(v) => set({ assignees: toggle(f.assignees, v) })} />
          </Panel>
          <Panel id="cause" title="Issues by root cause">
            <BarList data={byCause} />
          </Panel>
          <Panel id="workload" title="Open workload by assignee (click to filter)">
            <BarList data={byAssignee} selected={f.assignees} onSelect={(v) => set({ assignees: toggle(f.assignees, v) })} />
          </Panel>
          {/* Without custom fields this is the last panel; let it span the row. */}
          <div className={customFields.length ? undefined : "lg:col-span-2"}>
            <Panel id="location" title="Issues by location">
              <BarList data={byLocation} />
            </Panel>
          </div>
          {customFields.length ? (
            <Panel
              id="custom"
              title="Issues by custom field"
              action={
                <select
                  value={activeField}
                  onChange={(e) => setField(e.target.value)}
                  className="min-h-8 max-w-[14rem] rounded-lg border border-[color:var(--brand-border)] bg-white px-2 text-xs"
                >
                  {customFields.map((c) => (
                    <option key={c.label} value={c.label}>
                      {c.label} ({c.count})
                    </option>
                  ))}
                </select>
              }
            >
              <BarList data={byCustom} />
            </Panel>
          ) : null}
        </div>

        <Panel id="register" title={`Issue register (${issues.length})`}>
          <RegisterTable
            columns={columns}
            items={issues}
            rowKey={(i) => i.key}
            noun="issues"
            layout={layout}
            onLayoutChange={setLayout}
            defaultSort={ISSUE_DEFAULT_SORT}
          />
        </Panel>
      </div>
    </PanelLayoutContext.Provider>
  );
}
