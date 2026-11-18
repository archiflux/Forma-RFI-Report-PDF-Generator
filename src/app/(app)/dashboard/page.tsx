"use client";

import { useDashLayout } from "@/lib/layout/use-dash-layout";
import Link from "next/link";
import { DashTitle, DashboardSkeleton } from "@/components/dashboard/loading-status";
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
  const { layout, setLayout, sel } = useDashLayout("issues", useProjectSelection());
  const { hubId, chosen } = sel;
  const { dataset, loading, total, retryFailed } = useDashboardData(hubId, chosen);
  const locations = useProjectLocations(chosen);
  const now = useMemo(() => new Date(), []);

  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <SelectionSidebar sel={sel} />
      <div className="min-w-0 space-y-4">
        <DashTitle
          title="Issues dashboard"
          intro={<>BCF issue workflow across {chosen.length || "no"} selected project{chosen.length === 1 ? "" : "s"}.</>}
          aside={
            <Link href="/templates" className="text-sm font-medium text-[color:var(--brand-secondary)] underline-offset-4 hover:underline">
              All templates
            </Link>
          }
          loading={loading}
          total={total}
          records={dataset.issues.length}
          noun="issues"
        />
        <ProjectNotices projects={dataset.projects} onRetry={retryFailed} />
        {chosen.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[color:var(--brand-border)] p-10 text-center text-sm text-[color:var(--brand-muted)]">
            Tick one or more projects, or load a saved set, to build the dashboard.
          </p>
        ) : (
          <>
            {loading && dataset.issues.length === 0 ? (
              <DashboardSkeleton />
            ) : (
              <DashboardView dataset={dataset} now={now} locations={locations} layout={layout} onLayoutChange={setLayout} />
            )}
            <SharePanel
              kind="issues"
              layout={layout}
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
