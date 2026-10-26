"use client";

import { useMemo, useState } from "react";
import { applyGenericFilters, buildGenericReport, dimValues, openClosedByProject } from "@/lib/generic/aggregate";
import { Treemap } from "@/components/charts/treemap";
import { Donut } from "@/components/charts/donut";
import { Gauge } from "@/components/charts/gauge";
import { StackedArea } from "@/components/charts/stacked-area";
import { OpenClosedBars } from "@/components/charts/open-closed-bars";
import { OverdueTable } from "@/components/charts/overdue-table";
import { monthlyByCategory, topOverdue } from "@/lib/charts/series";
import { DateRangeFilter } from "@/components/dashboard/date-range-filter";
import { EMPTY_GENERIC_FILTERS, type BaseRecord, type GenericConfig, type GenericDataset, type GenericFilters } from "@/lib/generic/types";
import { BarList } from "@/components/dashboard/bar-list";
import { MultiSelect } from "@/components/dashboard/multi-select";
import { Panel } from "@/components/dashboard/panel";
import { PdfButton } from "@/components/dashboard/pdf-button";
import { TrendChart } from "@/components/dashboard/trend-chart";
import type { ProjectLocation } from "@/lib/aps/project-location";
import { globePoints } from "@/lib/dashboard/globe";
import { ProjectGlobe } from "@/components/dashboard/project-globe";
import { GenericTable } from "./generic-table";
import { CustomFieldFilter } from "@/components/dashboard/custom-field-filter";

function Tile({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className="rounded-xl border border-[color:var(--brand-border)] bg-white p-4 shadow-card">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-muted)]">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${alert ? "text-[color:var(--status-critical)]" : "text-[color:var(--brand-primary)]"}`}>{value}</p>
    </div>
  );
}

export function GenericView<T extends BaseRecord>({
  cfg,
  dataset,
  now,
  title,
  locations,
}: {
  cfg: GenericConfig<T>;
  dataset: GenericDataset<T>;
  now: Date;
  title?: string;
  locations?: Record<string, ProjectLocation | null>;
}) {
  const [f, setF] = useState<GenericFilters>(EMPTY_GENERIC_FILTERS);
  const all = dataset.items;
  const items = useMemo(() => applyGenericFilters(all, cfg, f), [all, cfg, f]);
  const customs = useMemo(() => (cfg.customOf ? all.map((t) => cfg.customOf?.(t)) : []), [all, cfg]);
  const setDim = (id: string, v: string[]) => setF((cur) => ({ ...cur, dims: { ...cur.dims, [id]: v } }));
  const kpis = useMemo(() => cfg.kpis(items, now), [cfg, items, now]);
  const trend = useMemo(() => cfg.trend.build(items), [cfg, items]);
  const breakdowns = useMemo(() => cfg.breakdowns.map((b) => ({ b, data: b.build(items, now) })), [cfg, items, now]);
  const donut = useMemo(() => cfg.donut?.build(items) ?? [], [cfg, items]);
  const tree = useMemo(() => cfg.treemap?.build(items) ?? [], [cfg, items]);
  const gaugeValue = useMemo(() => cfg.gauge?.value(items) ?? null, [cfg, items]);
  const byProject = useMemo(() => openClosedByProject(items, cfg, now), [items, cfg, now]);
  const statusMonths = useMemo(
    () => (cfg.statusOf && cfg.dateFilter ? monthlyByCategory(items, cfg.dateFilter.get, cfg.statusOf) : null),
    [items, cfg],
  );
  const overdue = useMemo(() => (cfg.overdue ? topOverdue(items, cfg.isOpen, cfg.overdue.dueOf, now) : []), [items, cfg, now]);
  const toggleProject = (id: string) =>
    setF((cur) => ({ ...cur, projectIds: cur.projectIds.includes(id) ? cur.projectIds.filter((x) => x !== id) : [...cur.projectIds, id] }));
  const toggleDimLabel = (fid: string, label: string) => {
    const dim = cfg.filters.find((d) => d.id === fid);
    if (!dim) return;
    const sel = f.dims[fid] ?? [];
    const raw = [...new Set(all.flatMap((t) => dimValues(dim, t)))].find((v) => (dim.format ? dim.format(v) : v) === label) ?? label;
    setDim(fid, sel.includes(raw) ? sel.filter((x) => x !== raw) : [...sel, raw]);
  };
  const dimSelectedLabels = (fid: string) => {
    const dim = cfg.filters.find((d) => d.id === fid);
    return (f.dims[fid] ?? []).map((v) => (dim?.format ? dim.format(v) : v));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <MultiSelect
          label="Project"
          options={dataset.projects.filter((p) => p.count).map((p) => ({ value: p.id, label: p.name }))}
          value={f.projectIds}
          onChange={(v) => setF((cur) => ({ ...cur, projectIds: v }))}
        />
        {cfg.filters.map((d) => (
          <MultiSelect
            key={d.id}
            label={d.label}
            options={[...new Set(all.flatMap((t) => dimValues(d, t)))].sort().map((v) => ({ value: v, label: d.format ? d.format(v) : v }))}
            value={f.dims[d.id] ?? []}
            onChange={(v) => setDim(d.id, v)}
          />
        ))}
        {cfg.dateFilter ? (
          <DateRangeFilter label={cfg.dateFilter.label} from={f.from} to={f.to} onChange={(r) => setF((cur) => ({ ...cur, from: r.from, to: r.to }))} />
        ) : null}
        {cfg.customOf ? (
          <CustomFieldFilter customs={customs} value={f.custom} onChange={(v) => setF((cur) => ({ ...cur, custom: v }))} />
        ) : null}
        <input
          type="search"
          placeholder="Search"
          value={f.search}
          onChange={(e) => setF((cur) => ({ ...cur, search: e.target.value }))}
          className="min-h-9 w-56 rounded-lg border border-[color:var(--brand-border)] bg-white px-3 text-xs"
        />
        {items.length !== all.length ? (
          <button type="button" className="text-xs text-[color:var(--brand-secondary)] underline" onClick={() => setF(EMPTY_GENERIC_FILTERS)}>
            Reset filters ({items.length} of {all.length})
          </button>
        ) : null}
        <div className="ml-auto">
          <PdfButton
            build={(includeRegister, maxRegisterRows) =>
              buildGenericReport({
                cfg,
                items,
                filters: f,
                projectNames: Object.fromEntries(dataset.projects.map((p) => [p.id, p.name])),
                now,
                includeRegister,
                maxRegisterRows,
                ...(title ? { title } : {}),
              })
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => (
          <Tile key={k.label} label={k.label} value={k.value} alert={k.alert} />
        ))}
      </div>

      {locations ? (
        <Panel title="Projects on the map">
          <ProjectGlobe
            noun={cfg.noun}
            {...globePoints(items, dataset.projects, locations, cfg.isOpen)}
            selected={f.projectIds}
            onSelect={toggleProject}
          />
        </Panel>
      ) : null}

      {cfg.gauge || cfg.donut ? (
        <div className="grid gap-4 lg:grid-cols-3 [&>*]:min-w-0">
          {cfg.gauge ? (
            <Panel title={cfg.gauge.title}>
              <Gauge value={gaugeValue} unit={cfg.gauge.unit} caption={cfg.gauge.title} />
            </Panel>
          ) : null}
          {cfg.donut ? (
            <div className={cfg.gauge ? "lg:col-span-2" : "lg:col-span-3"}>
              <Panel title={cfg.donut.title}>
                <Donut data={donut} centreLabel={cfg.noun} />
              </Panel>
            </div>
          ) : null}
        </div>
      ) : null}

      {cfg.treemap ? (
        <Panel title={cfg.treemap.filterId ? `${cfg.treemap.title} (click to filter)` : cfg.treemap.title}>
          <Treemap
            data={tree}
            {...(cfg.treemap.filterId
              ? { selected: dimSelectedLabels(cfg.treemap.filterId), onSelect: (l: string) => toggleDimLabel(cfg.treemap?.filterId as string, l) }
              : {})}
          />
        </Panel>
      ) : null}

      <Panel title="Open and closed by project (click a project to filter)">
        <OpenClosedBars rows={byProject} selected={f.projectIds} onSelect={toggleProject} />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        {statusMonths ? (
          <Panel title={`${cfg.noun.charAt(0).toUpperCase()}${cfg.noun.slice(1)} per month, by status today`}>
            <StackedArea rows={statusMonths.rows} categories={statusMonths.categories} />
          </Panel>
        ) : null}
        <Panel title={cfg.trend.title}>
          <TrendChart data={trend} series={cfg.trend.series} ariaLabel={cfg.trend.title} />
        </Panel>
        {cfg.overdue ? (
          <div className="lg:col-span-2">
            <Panel title={cfg.overdue.title}>
              <OverdueTable
                ownerLabel={cfg.overdue.ownerLabel}
                rows={overdue.map(({ item, due, daysOverdue }) => {
                  const o = cfg.overdue!;
                  const href = cfg.linkOf(item);
                  const owner = o.ownerOf(item);
                  return {
                    key: item.key,
                    title: o.titleOf(item),
                    ...(href ? { href } : {}),
                    project: item.projectName,
                    number: o.numberOf(item),
                    ...(owner ? { owner } : {}),
                    due,
                    daysOverdue,
                  };
                })}
              />
            </Panel>
          </div>
        ) : null}
        {breakdowns.map(({ b, data }, bi) => {
          const wide = bi === breakdowns.length - 1 && breakdowns.length % 2 === 1;
          const fid = b.filterId;
          const sel = fid ? (f.dims[fid] ?? []) : [];
          const dim = cfg.filters.find((d) => d.id === fid);
          return (
            <div key={b.title} className={wide ? "lg:col-span-2" : undefined}>
              <Panel title={fid ? `${b.title} (click to filter)` : b.title}>
              <BarList
                data={data}
                {...(fid && dim
                  ? {
                      // Bars show formatted labels; map back to raw values.
                      selected: sel.map((v) => (dim.format ? dim.format(v) : v)),
                      onSelect: (label: string) => {
                        const raw = [...new Set(all.flatMap((t) => dimValues(dim, t)))].find((v) => (dim.format ? dim.format(v) : v) === label) ?? label;
                        setDim(fid, sel.includes(raw) ? sel.filter((x) => x !== raw) : [...sel, raw]);
                      },
                    }
                  : {})}
              />
            </Panel>
            </div>
          );
        })}
      </div>

      <Panel title={`Register (${items.length})`}>
        <GenericTable cfg={cfg} items={items} now={now} />
      </Panel>
    </div>
  );
}
