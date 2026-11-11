"use client";

import { FailedNotice } from "@/components/dashboard/project-notices";
import { useDashLayout } from "@/lib/layout/use-dash-layout";
import Link from "next/link";
import { Suspense, useMemo } from "react";
import { useProjectSelection } from "@/lib/dashboard/use-project-selection";
import { useFormsData } from "@/lib/forms/use-forms-data";
import { useProjectLocations } from "@/lib/dashboard/use-project-locations";
import { SelectionSidebar } from "@/components/dashboard/selection-sidebar";
import { FormsView } from "@/components/forms/forms-view";
import { SharePanel } from "@/components/dashboard/share-panel";
import { redactForms } from "@/lib/forms/snapshot";

function FormsDashboard() {
  const { layout, setLayout, sel } = useDashLayout("forms", useProjectSelection());
  const { hubId, chosen } = sel;
  const { dataset, loading, total, retryFailed } = useFormsData(chosen);
  const locations = useProjectLocations(chosen);
  const now = useMemo(() => new Date(), []);
  const failed = dataset.projects.filter((p) => p.error);
  const skipped = dataset.projects.filter((p) => p.formsUnavailable);

  if (!hubId) {
    return <p className="text-sm">Pick a hub first - <Link href="/hubs" className="underline">choose hub</Link>.</p>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <SelectionSidebar sel={sel} />
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-[color:var(--brand-primary)]">Forms dashboard</h2>
            <p className="text-sm text-[color:var(--brand-muted)]">
              Forms across {chosen.length || "no"} selected project{chosen.length === 1 ? "" : "s"}.
              {loading ? ` Loading ${total - loading} of ${total}…` : ""}
            </p>
          </div>
          <Link href={`/templates?hubId=${encodeURIComponent(hubId)}`} className="text-sm font-medium text-[color:var(--brand-secondary)] underline-offset-4 hover:underline">
            All templates
          </Link>
        </div>
        <FailedNotice failed={failed} onRetry={retryFailed} />
        {skipped.length ? (
          <details className="rounded-lg border border-[color:var(--brand-border)] bg-white px-3 py-2 text-xs">
            <summary className="cursor-pointer font-medium">{skipped.length} project{skipped.length === 1 ? "" : "s"} skipped: the Forms tool isn&apos;t switched on</summary>
            <ul className="mt-1 list-disc pl-5">{skipped.map((p) => <li key={p.id}>{p.name}</li>)}</ul>
          </details>
        ) : null}
        {chosen.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[color:var(--brand-border)] p-10 text-center text-sm text-[color:var(--brand-muted)]">
            Tick one or more projects, or load a saved set, to build the dashboard.
          </p>
        ) : (
          <>
            <FormsView dataset={dataset} now={now} locations={locations} layout={layout} onLayoutChange={setLayout} />
            <SharePanel
              kind="forms"
              layout={layout}
              itemCount={dataset.forms.length}
              defaultTitle="Forms dashboard"
              redactionNote="replace people's names with Person 1, Person 2."
              buildData={(redacted) =>
                redacted
                  ? redactForms(dataset)
                  : { projects: dataset.projects.filter((p) => !p.error && !p.formsUnavailable), forms: dataset.forms }
              }
            />
          </>
        )}
      </div>
    </div>
  );
}

export default function FormsDashboardPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[color:var(--brand-muted)]">Loading…</p>}>
      <FormsDashboard />
    </Suspense>
  );
}
