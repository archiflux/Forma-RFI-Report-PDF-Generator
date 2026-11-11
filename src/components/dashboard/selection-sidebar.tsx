"use client";

import type { useProjectSelection } from "@/lib/dashboard/use-project-selection";
import Link from "next/link";
import { ProjectPicker } from "./project-picker";

export function SelectionSidebar({ sel }: { sel: ReturnType<typeof useProjectSelection> }) {
  return (
    <aside className="h-fit rounded-2xl border border-[color:var(--brand-border)] bg-white p-4 shadow-card lg:sticky lg:top-20">
      {sel.projectsQ.isLoading ? (
        <p className="text-xs text-[color:var(--brand-muted)]">Loading projects…</p>
      ) : sel.projectsQ.isError ? (
        <p className="text-xs text-red-600">{String(sel.projectsQ.error)}</p>
      ) : (
        <>
          {sel.failedHubs.length ? (
            <p className="mb-2 rounded-lg bg-amber-50 px-2 py-1 text-[11px] text-amber-800">Couldn&apos;t list projects in: {sel.failedHubs.join(", ")}.</p>
          ) : null}
          {sel.all.length === 0 ? (
            <p className="mb-2 text-xs text-[color:var(--brand-muted)]">
              No Forma projects found for your account. <Link href="/hubs" className="underline">See why</Link>.
            </p>
          ) : null}
          <ProjectPicker
            showHub={sel.multiHub}
            projects={sel.all}
            selected={sel.selected}
            onChange={sel.setSelected}
            sets={sel.sets}
            canSave={sel.canSave}
            onSaveSet={sel.saveSet}
            onDeleteSet={sel.removeSet}
          />
        </>
      )}
    </aside>
  );
}
