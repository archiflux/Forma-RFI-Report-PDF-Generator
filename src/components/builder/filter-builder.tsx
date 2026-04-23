"use client";

import type { CustomAttributeDef } from "@/lib/aps/types";
import type { FilterSpec } from "@/lib/report/types";
import type { WorkflowStatus } from "@/lib/aps/workflow";

interface Props {
  filter: FilterSpec;
  onChange: (next: FilterSpec) => void;
  customAttributes: CustomAttributeDef[];
  workflow: WorkflowStatus[];
}

function MultiSelectPills({
  options,
  selected,
  onChange,
  emptyLabel,
}: {
  options: { id: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
  emptyLabel: string;
}) {
  const set = new Set(selected);
  function toggle(id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  }
  if (options.length === 0)
    return <p className="text-xs text-neutral-500">{emptyLabel}</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const on = set.has(opt.id);
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => toggle(opt.id)}
            className={
              on
                ? "rounded-full bg-[color:var(--brand-primary)] px-2.5 py-0.5 text-xs text-white"
                : "rounded-full border border-neutral-300 px-2.5 py-0.5 text-xs text-neutral-700 hover:bg-neutral-50"
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function DateRangeInputs({
  value,
  onChange,
}: {
  value: { gte?: string; lte?: string } | undefined;
  onChange: (r: { gte?: string; lte?: string } | undefined) => void;
}) {
  const gte = value?.gte ?? "";
  const lte = value?.lte ?? "";
  function set(next: { gte?: string; lte?: string }) {
    if (!next.gte && !next.lte) onChange(undefined);
    else onChange(next);
  }
  return (
    <div className="flex items-center gap-2">
      <input
        type="date"
        value={gte}
        onChange={(e) => set({ gte: e.target.value || undefined, lte: lte || undefined })}
        className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm"
      />
      <span className="text-xs text-neutral-400">to</span>
      <input
        type="date"
        value={lte}
        onChange={(e) => set({ gte: gte || undefined, lte: e.target.value || undefined })}
        className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm"
      />
    </div>
  );
}

export function FilterBuilder({ filter, onChange, customAttributes, workflow }: Props) {
  function setRoot<K extends keyof FilterSpec>(key: K, v: FilterSpec[K]) {
    const next = { ...filter, [key]: v };
    if (v === undefined || (Array.isArray(v) && v.length === 0) || v === "") delete next[key];
    onChange(next);
  }

  function setCustom(attrId: string, clause: NonNullable<FilterSpec["customAttributes"]>[string]) {
    const prev = filter.customAttributes ?? {};
    const nextClause =
      !clause.contains &&
      !clause.range?.gte &&
      !clause.range?.lte &&
      (!clause.values || clause.values.length === 0)
        ? undefined
        : clause;
    const next = { ...prev };
    if (nextClause) next[attrId] = nextClause;
    else delete next[attrId];
    onChange({
      ...filter,
      customAttributes: Object.keys(next).length ? next : undefined,
    });
  }

  const statusOptions = workflow.map((w) => ({ id: w.id, label: w.label }));

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-neutral-200">
      <h3 className="text-sm font-semibold">Filters</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Leave any section blank to skip that filter. All active filters combine with AND.
      </p>

      <div className="mt-4 space-y-5">
        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-neutral-500">
            Free-text search
          </label>
          <input
            type="search"
            value={filter.search ?? ""}
            onChange={(e) => setRoot("search", e.target.value || undefined)}
            placeholder="Matches RFI #, title, question, or response"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
          />
        </div>

        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-neutral-500">
            Status
          </label>
          <div className="mt-1">
            <MultiSelectPills
              options={statusOptions}
              selected={filter.status ?? []}
              onChange={(v) => setRoot("status", v.length ? v : undefined)}
              emptyLabel="Workflow statuses load once the project is fetched."
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-neutral-500">
            Assignee name contains
          </label>
          <input
            type="search"
            value={filter.assigneeContains ?? ""}
            onChange={(e) => setRoot("assigneeContains", e.target.value || undefined)}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-neutral-500">
              Due date between
            </label>
            <div className="mt-1">
              <DateRangeInputs
                value={filter.dueDate}
                onChange={(r) => setRoot("dueDate", r)}
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-neutral-500">
              Created between
            </label>
            <div className="mt-1">
              <DateRangeInputs
                value={filter.createdAt}
                onChange={(r) => setRoot("createdAt", r)}
              />
            </div>
          </div>
        </div>

        {customAttributes.length > 0 ? (
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">
              Custom attributes
            </p>
            <div className="mt-2 space-y-4">
              {customAttributes.map((attr) => {
                const clause = filter.customAttributes?.[attr.id] ?? {};
                return (
                  <div key={attr.id} className="rounded-md border border-neutral-200 p-3">
                    <p className="text-sm font-medium">{attr.name}</p>
                    <p className="text-[10px] uppercase tracking-wider text-neutral-400">
                      {attr.dataType}
                    </p>
                    <div className="mt-2">
                      {attr.dataType === "text" ? (
                        <input
                          type="search"
                          placeholder="contains…"
                          value={clause.contains ?? ""}
                          onChange={(e) =>
                            setCustom(attr.id, { ...clause, contains: e.target.value || undefined })
                          }
                          className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm"
                        />
                      ) : null}
                      {attr.dataType === "numeric" ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            placeholder="min"
                            value={clause.range?.gte ?? ""}
                            onChange={(e) =>
                              setCustom(attr.id, {
                                ...clause,
                                range: {
                                  ...(clause.range ?? {}),
                                  gte: e.target.value === "" ? undefined : Number(e.target.value),
                                },
                              })
                            }
                            className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm"
                          />
                          <span className="text-xs text-neutral-400">to</span>
                          <input
                            type="number"
                            placeholder="max"
                            value={clause.range?.lte ?? ""}
                            onChange={(e) =>
                              setCustom(attr.id, {
                                ...clause,
                                range: {
                                  ...(clause.range ?? {}),
                                  lte: e.target.value === "" ? undefined : Number(e.target.value),
                                },
                              })
                            }
                            className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm"
                          />
                        </div>
                      ) : null}
                      {(attr.dataType === "singleChoice" || attr.dataType === "multiChoice") &&
                      attr.values ? (
                        <MultiSelectPills
                          options={attr.values}
                          selected={clause.values ?? []}
                          onChange={(v) =>
                            setCustom(attr.id, { ...clause, values: v.length ? v : undefined })
                          }
                          emptyLabel="(no choices configured)"
                        />
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
