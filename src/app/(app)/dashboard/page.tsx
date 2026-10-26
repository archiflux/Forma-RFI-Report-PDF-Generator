"use client";

import Link from "next/link";
import { Suspense, useMemo } from "react";
import { useProjectSelection } from "@/lib/dashboard/use-project-selection";
import { useDashboardData } from "@/lib/dashboard/use-dashboard-data";
import { useProjectLocations } from "@/lib/dashboard/use-project-locations";
import { SelectionSidebar } from "@/components/dashboard/selection-sidebar";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { SharePanel } from "@/components/dashboard/share-panel";
import { makeSnapshot } from "@/lib/dashboard/snapshot";
import { ProjectNotices } from "@/components/dashboard/project-notices";

function Dashboard() {
  const sel = useProjectSelection();
  const { hubId, chosen } = sel;
  const { dataset, loading, total } = useDashboardData(hubId, chosen);
  const locations = useProjectLocations(chosen);
  const now = useMemo(() => new Date(), []);

  if (!hubId) {
    return (
      <p className="text-sm">
        Pick a hub first - <Link href="/hubs" className="underline">choose hub</Link>.
      </p>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <SelectionSidebar sel={sel} />
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-[color:var(--brand-primary)]">Issues dashboard</h2>
            <p className="text-sm text-[color:var(--brand-muted)]">
              BCF issue workflow across {chosen.length || "no"} selected project{chosen.length === 1 ? "" : "s"}.
              {loading ? ` Loading ${total - loading} of ${total}…` : ""}
            </p>
          </div>
          <Link href={`/templates?hubId=${encodeURIComponent(hubId)}`} className="text-sm font-medium text-[color:var(--brand-secondary)] underline-offset-4 hover:underline">
            All templates
          </Link>
        </div>
        <ProjectNotices projects={dataset.projects} />
        {chosen.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[color:var(--brand-border)] p-10 text-center text-sm text-[color:var(--brand-muted)]">
            Tick one or more projects, or load a saved set, to build the dashboard.
          </p>
        ) : (
          <>
            <DashboardView dataset={dataset} now={now} locations={locations} />
            <SharePanel
              kind="issues"
              itemCount={dataset.issues.length}
              defaultTitle="Issues dashboard"
              redactionNote="replace people's names with Person 1, Person 2 and leave out descriptions and custom fields."
              buildData={(redacted) =>
                makeSnapshot(
                  dataset,
                  redacted
                    ? { includeDescriptions: false, anonymisePeople: true, includeCustomFields: false }
                    : { includeDescriptions: true, anonymisePeople: false, includeCustomFields: true },
                )
              }
            />
          </>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[color:var(--brand-muted)]">Loading…</p>}>
      <Dashboard />
    </Suspense>
  );
}
