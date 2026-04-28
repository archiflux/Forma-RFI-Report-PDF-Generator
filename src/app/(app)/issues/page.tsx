"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useIssuesData } from "@/lib/aps/use-issues-data";
import { RfiGrid } from "@/components/rfi-grid";
import { Button } from "@/components/ui/button";

function MetadataBanner({ attrsMissingTitles }: { attrsMissingTitles: boolean }) {
  if (!attrsMissingTitles) return null;
  return (
    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <p className="font-semibold">Limited project metadata</p>
      <p className="mt-1 text-xs">
        One or more custom-field titles couldn&apos;t be resolved. Those columns
        show their raw IDs as the header. Filtering, sorting, and export still
        work.
      </p>
    </div>
  );
}

function IssuesInner() {
  const router = useRouter();
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

  const isRateLimited = /\b429\b|rate[- ]?limit/i.test(
    error instanceof Error ? error.message : "",
  );

  return (
    <section>
      <div className="rounded-2xl border border-[color:var(--brand-border)] bg-white p-5 shadow-card sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--brand-secondary)]">
              Step 3 of 3 · Issues
            </p>
            <h2 className="mt-1 truncate text-2xl font-semibold text-[color:var(--brand-primary)]">
              {projectName ?? "Project issues"}
            </h2>
            <p className="mt-2 text-sm text-[color:var(--brand-muted)]">
              {isLoading
                ? "Loading issues…"
                : `${items.length.toLocaleString()} ${items.length === 1 ? "issue" : "issues"} loaded`}
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
              disabled={isLoading || items.length === 0}
              onClick={() => {
                const qs = new URLSearchParams({ hubId, projectId }).toString();
                router.push(`/issues/builder?${qs}`);
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

      <MetadataBanner attrsMissingTitles={attrsMissingTitles} />

      {!isLoading && !isError && (shouldHydrate || hydrating || hydrated) ? (
        <div className="mt-4 rounded-xl border border-[color:var(--brand-secondary)]/20 bg-[color:var(--brand-secondary)]/5 px-4 py-3 text-sm text-[color:var(--brand-secondary)]">
          {hydrated ? (
            <p className="font-semibold">
              Loaded full issue detail — custom fields are now populated.
            </p>
          ) : hydrating ? (
            <>
              <p className="font-semibold">
                Loading full issue detail (
                {hydrationProgress?.hydrated ?? 0} / {hydrationProgress?.total ?? items.length})
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
                  Fetch each issue&apos;s full detail individually so custom
                  fields appear in the field picker, filters, and exported
                  reports.
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => hydrate()}>
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
        <div className="mt-6 rounded-2xl border border-[color:var(--brand-border)] bg-white p-5 shadow-card">
          <p className="text-sm font-semibold text-[color:var(--brand-primary)]">
            Loading issues…
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
              : "Failed to load issues"}
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
    <Suspense
      fallback={
        <p className="text-sm text-[color:var(--brand-muted)]">Loading…</p>
      }
    >
      <IssuesInner />
    </Suspense>
  );
}
