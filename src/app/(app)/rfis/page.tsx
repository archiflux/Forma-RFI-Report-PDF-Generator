"use client";

import Link from "next/link";
import { Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { buildStatusLabelMap } from "@/lib/aps/workflow";
import { useRfiData } from "@/lib/aps/use-rfi-data";
import { RfiGrid } from "@/components/rfi-grid";
import { Button } from "@/components/ui/button";

function MetadataBanner({
  attrsMissingTitles,
  workflowMissing,
}: {
  attrsMissingTitles: boolean;
  workflowMissing: boolean;
}) {
  if (!attrsMissingTitles && !workflowMissing) return null;
  return (
    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <p className="font-semibold">Limited project metadata</p>
      <ul className="mt-1 list-disc pl-5 text-xs">
        {attrsMissingTitles ? (
          <li>
            One or more custom-field titles couldn&apos;t be resolved (Forma
            didn&apos;t include them in the RFI payload and you don&apos;t have
            <em> Manage Custom Attributes</em> permission). Those columns show
            their raw IDs as the header. Filtering, sorting, and export still
            work.
          </li>
        ) : null}
        {workflowMissing ? (
          <li>
            The RFI workflow couldn&apos;t be loaded. Status columns show the
            raw status id rather than its label.
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function RfisInner() {
  const router = useRouter();
  const params = useSearchParams();
  const hubId = params.get("hubId") ?? "";
  const projectId = params.get("projectId") ?? "";

  const {
    rfis,
    attrs,
    workflow,
    isLoading,
    isError,
    error,
    attrsMissingTitles,
    workflowMissing,
    shouldHydrate,
    hydrating,
    hydrationProgress,
    hydrateError,
    hydrated,
    hydrate,
    projectName,
  } = useRfiData(projectId, hubId);

  const statusLabels = useMemo(
    () => (workflow.length ? buildStatusLabelMap(workflow) : undefined),
    [workflow],
  );

  if (!projectId) {
    return (
      <p className="text-sm text-red-600">
        Missing projectId —{" "}
        <Link href="/hubs" className="underline">
          choose a project
        </Link>
        .
      </p>
    );
  }

  const isRateLimited = /\b429\b|rate[- ]?limit/i.test(
    error instanceof Error ? error.message : "",
  );

  return (
    <section>
      <div className="rounded-2xl border border-[color:var(--brand-border)] bg-white p-5 shadow-card sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--brand-secondary)]">
              Step 3 of 3 · RFIs
            </p>
            <h2 className="mt-1 truncate text-2xl font-semibold text-[color:var(--brand-primary)]">
              {projectName ?? "Project RFIs"}
            </h2>
            <p className="mt-2 text-sm text-[color:var(--brand-muted)]">
              {isLoading
                ? "Loading RFIs…"
                : `${rfis.length.toLocaleString()} ${rfis.length === 1 ? "RFI" : "RFIs"} loaded`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/projects?hubId=${encodeURIComponent(hubId)}`}
              className="text-sm font-medium text-[color:var(--brand-secondary)] underline-offset-4 hover:underline"
            >
              ← Change project
            </Link>
            <Button
              disabled={isLoading || rfis.length === 0}
              onClick={() => {
                // router.push keeps the SPA alive — a full reload would
                // wipe TanStack Query's in-memory cache and force the user
                // to re-hydrate the project (potentially several minutes
                // on a 600+ RFI project).
                const qs = new URLSearchParams({ hubId, projectId }).toString();
                router.push(`/builder?${qs}`);
              }}
            >
              Build report →
            </Button>
          </div>
        </div>
        <div
          aria-hidden
          className="mt-5 h-1 w-16 rounded-full bg-[color:var(--brand-accent)]"
        />
      </div>

      <MetadataBanner attrsMissingTitles={attrsMissingTitles} workflowMissing={workflowMissing} />

      {!isLoading && !isError && (shouldHydrate || hydrating || hydrated) ? (
        <div className="mt-4 rounded-xl border border-[color:var(--brand-secondary)]/20 bg-[color:var(--brand-secondary)]/5 px-4 py-3 text-sm text-[color:var(--brand-secondary)]">
          {hydrated ? (
            <p className="font-semibold">
              Loaded full RFI detail — custom fields are now populated.
            </p>
          ) : hydrating ? (
            <>
              <p className="font-semibold">
                Loading full RFI detail (
                {hydrationProgress?.hydrated ?? 0} / {hydrationProgress?.total ?? rfis.length})
              </p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--brand-secondary)]/15">
                <div
                  className="h-full bg-[color:var(--brand-secondary)] transition-[width]"
                  style={{
                    width: `${
                      hydrationProgress && hydrationProgress.total > 0
                        ? (hydrationProgress.hydrated / hydrationProgress.total) * 100
                        : 5
                    }%`,
                  }}
                />
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">Custom fields not in the search response</p>
                <p className="mt-1 text-xs leading-relaxed">
                  Forma&apos;s search endpoint didn&apos;t include custom-attribute
                  values for this project. Fetch each RFI&apos;s full detail
                  individually — slower, but the only way to surface custom
                  fields when search omits them. Hundreds of RFIs typically
                  finish in 5–15 seconds.
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => hydrate()}>
                Load full RFI detail
              </Button>
            </div>
          )}
          {hydrateError ? (
            <p role="alert" className="mt-2 text-xs text-red-700">
              {hydrateError}
            </p>
          ) : null}
        </div>
      ) : null}

      {isLoading ? (
        <div className="mt-6 rounded-2xl border border-[color:var(--brand-border)] bg-white p-5 shadow-card">
          <p className="text-sm font-semibold text-[color:var(--brand-primary)]">
            Loading RFIs…
          </p>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--brand-canvas)]">
            <div className="h-full w-1/4 animate-pulse bg-[color:var(--brand-primary)]" />
          </div>
        </div>
      ) : null}

      {isError ? (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <p className="font-semibold">
            {isRateLimited
              ? "Forma is rate-limiting this project"
              : "Failed to load RFIs"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-red-700/90">
            {isRateLimited
              ? "Large projects can hit Autodesk's burst limits. The app already retries automatically — wait a minute and try again."
              : error instanceof Error
                ? error.message
                : String(error)}
          </p>
        </div>
      ) : null}

      {!isLoading && !isError ? (
        <RfiGrid
          rfis={rfis}
          customAttributes={attrs}
          statusLabels={statusLabels}
          projectId={projectId}
        />
      ) : null}
    </section>
  );
}

export default function RfisPage() {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-[color:var(--brand-muted)]">Loading…</p>
      }
    >
      <RfisInner />
    </Suspense>
  );
}
