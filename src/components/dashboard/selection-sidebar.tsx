"use client";

import type { useProjectSelection } from "@/lib/dashboard/use-project-selection";
import { ProjectPicker } from "./project-picker";

export function SelectionSidebar({ sel }: { sel: ReturnType<typeof useProjectSelection> }) {
  return (
    <aside className="h-fit rounded-2xl border border-[color:var(--brand-border)] bg-white p-4 shadow-card lg:sticky lg:top-20">
      {sel.projectsQ.isLoading ? (
        <p className="text-xs text-[color:var(--brand-muted)]">Loading projects…</p>
      ) : sel.projectsQ.isError ? (
        <p className="text-xs text-red-600">{String(sel.projectsQ.error)}</p>
      ) : (
        <ProjectPicker
          hubId={sel.hubId}
          projects={sel.all}
          selected={sel.selected}
          onChange={sel.setSelected}
          sets={sel.sets}
          canSave={sel.canSave}
          onSaveSet={sel.saveSet}
          onDeleteSet={sel.removeSet}
        />
      )}
    </aside>
  );
}
