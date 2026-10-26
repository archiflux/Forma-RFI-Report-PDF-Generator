"use client";

import { useMemo, useState } from "react";
import { applyGenericFilters, buildGenericReport, dimValues } from "@/lib/generic/aggregate";
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
            onSelect={(id) =>
              setF((cur) => ({ ...cur, projectIds: cur.projectIds.includes(id) ? cur.projectIds.filter((x) => x !== id) : [...cur.projectIds, id] }))
            }
          />
        </Panel>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={cfg.trend.title}>
          <TrendChart data={trend} series={cfg.trend.series} ariaLabel={cfg.trend.title} />
        </Panel>
        {breakdowns.map(({ b, data }) => {
          const fid = b.filterId;
          const sel = fid ? (f.dims[fid] ?? []) : [];
          const dim = cfg.filters.find((d) => d.id === fid);
          return (
            <Panel key={b.title} title={fid ? `${b.title} (click to filter)` : b.title}>
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
          );
        })}
      </div>

      <Panel title={`Register (${items.length})`}>
        <GenericTable cfg={cfg} items={items} now={now} />
      </Panel>
    </div>
  );
}
