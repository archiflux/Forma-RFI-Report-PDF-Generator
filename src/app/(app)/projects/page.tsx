"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApsClient } from "@/lib/aps/use-client";
import { listProjects } from "@/lib/aps/projects";

function ProjectsList() {
  const params = useSearchParams();
  const hubId = params.get("hubId") ?? "";
  const client = useApsClient();

  const q = useQuery({
    queryKey: ["projects", hubId],
    queryFn: () => listProjects(client, hubId),
    enabled: Boolean(hubId),
  });

  if (!hubId) {
    return (
      <p className="text-sm text-red-600">
        Missing hubId — <Link href="/hubs" className="underline">go back</Link>.
      </p>
    );
  }

  return (
    <>
      {q.isLoading ? (
        <p className="mt-6 text-sm text-neutral-500">Loading projects…</p>
      ) : q.isError ? (
        <p className="mt-6 text-sm text-red-600">
          {q.error instanceof Error ? q.error.message : String(q.error)}
        </p>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(q.data ?? []).map((project) => {
            const qs = `hubId=${encodeURIComponent(hubId)}&projectId=${encodeURIComponent(project.id)}`;
            return (
              <li
                key={project.id}
                className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-neutral-200"
              >
                <p className="font-medium">{project.name}</p>
                <p className="mt-1 text-xs text-neutral-500">{project.id}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`/rfis?${qs}`}
                    className="rounded-lg bg-[color:var(--brand-primary)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                  >
                    RFIs report →
                  </Link>
                  <Link
                    href={`/issues?${qs}`}
                    className="rounded-lg border border-[color:var(--brand-primary)] px-3 py-1.5 text-xs font-medium text-[color:var(--brand-primary)] hover:bg-[color:var(--brand-primary)]/5"
                  >
                    Issues report →
                  </Link>
                </div>
              </li>
            );
          })}
          {q.data?.length === 0 ? (
            <p className="text-sm text-neutral-500">
              No projects in this hub that you have access to.
            </p>
          ) : null}
        </ul>
      )}
    </>
  );
}

export default function ProjectsPage() {
  return (
    <section>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Choose a project</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Projects are scoped to your signed-in Autodesk user.
          </p>
        </div>
        <Link href="/hubs" className="text-sm text-neutral-500 underline">
          Change hub
        </Link>
      </div>
      <Suspense fallback={<p className="mt-6 text-sm text-neutral-500">Loading…</p>}>
        <ProjectsList />
      </Suspense>
    </section>
  );
}
