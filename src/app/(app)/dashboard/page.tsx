"use client";

import Link from "next/link";
import { Suspense, useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useApsClient } from "@/lib/aps/use-client";
import { listProjects } from "@/lib/aps/projects";
import { getUserProfile } from "@/lib/aps/user-profile";
import { useProjectSets } from "@/lib/dashboard/use-project-sets";
import { useDashboardData } from "@/lib/dashboard/use-dashboard-data";
import { ProjectPicker } from "@/components/dashboard/project-picker";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { SnapshotPanel } from "@/components/dashboard/snapshot-panel";

function Dashboard() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const hubId = params.get("hubId") ?? "";
  const selected = useMemo(() => (params.get("p") ?? "").split(",").filter(Boolean), [params]);
  const client = useApsClient();

  const projectsQ = useQuery({
    queryKey: ["projects", hubId],
    queryFn: () => listProjects(client, hubId),
    enabled: Boolean(hubId),
  });
  const meQ = useQuery({ queryKey: ["user-profile"], queryFn: () => getUserProfile(client), staleTime: Infinity });
  const { sets, save, remove } = useProjectSets(meQ.data?.userId);

  // Selection lives in the URL so a dashboard can be bookmarked or sent to a
  // colleague who also has Forma access.
  const setSelected = useCallback(
    (ids: string[]) => {
      const next = new URLSearchParams(params.toString());
      if (ids.length) next.set("p", ids.join(","));
      else next.delete("p");
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  const all = useMemo(() => projectsQ.data ?? [], [projectsQ.data]);
  const chosen = useMemo(() => all.filter((p) => selected.includes(p.id)), [all, selected]);
  const { dataset, loading, total } = useDashboardData(hubId, chosen);
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
      <aside className="h-fit rounded-2xl border border-[color:var(--brand-border)] bg-white p-4 shadow-card lg:sticky lg:top-20">
        {projectsQ.isLoading ? (
          <p className="text-xs text-[color:var(--brand-muted)]">Loading projects…</p>
        ) : projectsQ.isError ? (
          <p className="text-xs text-red-600">{String(projectsQ.error)}</p>
        ) : (
          <ProjectPicker
            hubId={hubId}
            projects={all}
            selected={selected}
            onChange={setSelected}
            sets={sets}
            canSave={Boolean(meQ.data?.userId)}
            onSaveSet={(name) => save({ name, hubId, projects: chosen.map((p) => ({ id: p.id, name: p.name })) })}
            onDeleteSet={remove}
          />
        )}
      </aside>
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-[color:var(--brand-primary)]">Issues dashboard</h2>
            <p className="text-sm text-[color:var(--brand-muted)]">
              BCF issue workflow across {chosen.length || "no"} selected project{chosen.length === 1 ? "" : "s"}.
              {loading ? ` Loading ${total - loading} of ${total}…` : ""}
            </p>
          </div>
          <Link href="/templates" className="text-sm font-medium text-[color:var(--brand-secondary)] underline-offset-4 hover:underline">
            All templates
          </Link>
        </div>
        {dataset.projects.some((p) => p.error) ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {dataset.projects.filter((p) => p.error).map((p) => (
              <p key={p.id}>{p.name}: {p.error}</p>
            ))}
          </div>
        ) : null}
        {chosen.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[color:var(--brand-border)] p-10 text-center text-sm text-[color:var(--brand-muted)]">
            Tick one or more projects, or load a saved set, to build the dashboard.
          </p>
        ) : (
          <>
            <DashboardView dataset={dataset} now={now} />
            <SnapshotPanel dataset={dataset} />
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
