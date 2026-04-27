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
        <p className="mt-6 text-sm text-[color:var(--brand-muted)]">
          Loading projects…
        </p>
      ) : q.isError ? (
        <p className="mt-6 text-sm text-red-600">
          {q.error instanceof Error ? q.error.message : String(q.error)}
        </p>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(q.data ?? []).map((project) => {
            const qs = `hubId=${encodeURIComponent(hubId)}&projectId=${encodeURIComponent(project.id)}`;
            return (
              <li
                key={project.id}
                className="group flex flex-col rounded-2xl border border-[color:var(--brand-border)] bg-white p-5 shadow-card transition-colors hover:border-[color:var(--brand-primary)]"
              >
                <p className="font-semibold text-[color:var(--brand-primary)]">
                  {project.name}
                </p>
                <span
                  aria-hidden
                  className="mt-2 h-1 w-10 rounded-full bg-[color:var(--brand-accent)] transition-all group-hover:w-16"
                />
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/rfis?${qs}`}
                    className="rounded-lg bg-[color:var(--brand-primary)] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[color:var(--brand-secondary)]"
                  >
                    RFIs report →
                  </Link>
                  <Link
                    href={`/issues?${qs}`}
                    className="rounded-lg border border-[color:var(--brand-primary)] px-3 py-1.5 text-xs font-semibold text-[color:var(--brand-primary)] transition-colors hover:bg-[color:var(--brand-primary)]/5"
                  >
                    Issues report →
                  </Link>
                </div>
              </li>
            );
          })}
          {q.data?.length === 0 ? (
            <p className="text-sm text-[color:var(--brand-muted)]">
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--brand-secondary)]">
            Step 2 of 3
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-[color:var(--brand-primary)]">
            Choose a project
          </h2>
          <p className="mt-1 text-sm text-[color:var(--brand-muted)]">
            Projects are scoped to your signed-in Autodesk user.
          </p>
        </div>
        <Link
          href="/hubs"
          className="text-sm font-medium text-[color:var(--brand-secondary)] underline-offset-4 hover:underline"
        >
          ← Change hub
        </Link>
      </div>
      <Suspense
        fallback={
          <p className="mt-6 text-sm text-[color:var(--brand-muted)]">Loading…</p>
        }
      >
        <ProjectsList />
      </Suspense>
    </section>
  );
}
