"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Project } from "@/lib/aps/types";
import type { ProjectSet } from "@/lib/dashboard/project-sets";
import { sortByName } from "@/lib/aps/projects";

export interface PickerProps {
  hubId: string;
  projects: Project[];
  selected: string[];
  onChange: (ids: string[]) => void;
  sets: ProjectSet[];
  onSaveSet: (name: string) => void;
  onDeleteSet: (id: string) => void;
  canSave: boolean;
}

export function ProjectPicker({ hubId, projects, selected, onChange, sets, onSaveSet, onDeleteSet, canSave }: PickerProps) {
  const [q, setQ] = useState("");
  const [name, setName] = useState("");
  const shown = useMemo(
    () => projects.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase())),
    [projects, q],
  );
  const hubSets = sortByName(sets.filter((s) => s.hubId === hubId));

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-muted)]">My project sets</p>
        {hubSets.length === 0 ? (
          <p className="mt-1 text-xs text-[color:var(--brand-muted)]">None saved yet. Tick some projects and save them below.</p>
        ) : (
          <ul className="mt-1 space-y-1">
            {hubSets.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 text-xs">
                <button
                  type="button"
                  className="truncate text-left font-medium text-[color:var(--brand-primary)] hover:underline"
                  onClick={() => onChange(s.projects.map((p) => p.id))}
                  title={s.projects.map((p) => p.name).join(", ")}
                >
                  {s.name} <span className="text-[color:var(--brand-muted)]">({s.projects.length})</span>
                </button>
                <button type="button" aria-label={`Delete ${s.name}`} className="text-[color:var(--brand-muted)] hover:text-[color:var(--status-critical)]" onClick={() => onDeleteSet(s.id)}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim() || !selected.length) return;
            onSaveSet(name);
            setName("");
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name this selection"
            className="min-h-8 min-w-0 flex-1 rounded-lg border border-[color:var(--brand-border)] px-2 text-xs"
          />
          <Button size="sm" type="submit" disabled={!canSave || !name.trim() || !selected.length}>Save set</Button>
        </form>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-muted)]">
            Projects ({selected.length}/{projects.length})
          </p>
          <span className="flex gap-2 text-xs">
            <button type="button" className="underline" onClick={() => onChange([...new Set([...selected, ...shown.map((p) => p.id)])])}>All shown</button>
            <button type="button" className="underline" onClick={() => onChange([])}>None</button>
          </span>
        </div>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter projects"
          className="mt-1 min-h-8 w-full rounded-lg border border-[color:var(--brand-border)] px-2 text-xs"
        />
        <ul className="mt-2 max-h-[50vh] space-y-0.5 overflow-auto pr-1">
          {shown.map((p) => (
            <li key={p.id}>
              <label className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 text-xs hover:bg-[color:var(--brand-canvas)]">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={selected.includes(p.id)}
                  onChange={(e) => onChange(e.target.checked ? [...selected, p.id] : selected.filter((id) => id !== p.id))}
                />
                <span>{p.name}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
