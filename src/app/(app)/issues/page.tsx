"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useIssuesData } from "@/lib/aps/use-issues-data";
import { RfiGrid } from "@/components/rfi-grid";
import { Button } from "@/components/ui/button";

function MetadataBanner({ attrsMissingTitles }: { attrsMissingTitles: boolean }) {
  if (!attrsMissingTitles) return null;
  return (
    <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <p className="font-medium">Limited project metadata</p>
      <p className="mt-1 text-xs">
        One or more custom-field titles couldn&apos;t be resolved. Those columns
        show their raw IDs as the header. Filtering, sorting, and export still
        work.
      </p>
    </div>
  );
}

function IssuesInner() {
  const params = useSearchParams();
  const hubId = params.get("hubId") ?? "";
  const projectId = params.get("projectId") ?? "";

  const {
    items,
    attrs,
    isLoading,
    isError,
    error,
    attrsMissingTitles,
    shouldHydrate,
    hydrating,
    hydrationProgress,
    hydrateError,
    hydrated,
    hydrate,
    projectName,
  } = useIssuesData(projectId, hubId);

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

  return (
    <section>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Issues</h2>
          <p className="mt-1 text-sm text-neutral-600">
            {projectName ? (
              <>
                <span className="font-medium text-[color:var(--brand-ink)]">
                  {projectName}
                </span>
                <span className="text-neutral-400"> · </span>
              </>
            ) : null}
            <code className="rounded bg-neutral-100 px-1">{projectId}</code>
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/projects?hubId=${encodeURIComponent(hubId)}`}
            className="self-center text-sm text-neutral-500 underline"
          >
            Change project
          </Link>
          <Button
            disabled={isLoading || items.length === 0}
            onClick={() => {
              const qs = new URLSearchParams({ hubId, projectId }).toString();
              window.location.assign(`/issues/builder?${qs}`);
            }}
          >
            Build report →
          </Button>
        </div>
      </div>

      <MetadataBanner attrsMissingTitles={attrsMissingTitles} />

      {!isLoading && !isError && (shouldHydrate || hydrating || hydrated) ? (
        <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          {hydrated ? (
            <p className="font-medium">
              Loaded full issue detail — custom fields are now populated.
            </p>
          ) : hydrating ? (
            <>
              <p className="font-medium">
                Loading full issue detail (
                {hydrationProgress?.hydrated ?? 0} / {hydrationProgress?.total ?? items.length})
              </p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded bg-blue-100">
                <div
                  className="h-full bg-blue-600 transition-[width]"
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
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium">Custom fields not in the search response</p>
                <p className="mt-1 text-xs">
                  Click below to fetch each issue&apos;s full detail individually
                  so custom fields appear in the field picker, filters, and
                  exported reports.
                </p>
              </div>
              <Button size="sm" onClick={() => hydrate()}>
                Load full issue detail
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
        <div className="mt-6 rounded-xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
          <p className="text-sm font-medium">Loading issues…</p>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded bg-neutral-100">
            <div className="h-full w-1/4 animate-pulse bg-[color:var(--brand-primary)]" />
          </div>
        </div>
      ) : null}

      {isError ? (
        <p role="alert" className="mt-6 text-sm text-red-600">
          {error instanceof Error ? error.message : String(error)}
        </p>
      ) : null}

      {!isLoading && !isError ? (
        <RfiGrid
          rfis={items}
          customAttributes={attrs}
          projectId={projectId}
          itemKind="issue"
        />
      ) : null}
    </section>
  );
}

export default function IssuesPage() {
  return (
    <Suspense fallback={<p className="text-sm text-neutral-500">Loading…</p>}>
      <IssuesInner />
    </Suspense>
  );
}
