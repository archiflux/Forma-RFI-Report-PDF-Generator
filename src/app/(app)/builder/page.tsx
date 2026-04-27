"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { buildStatusLabelMap } from "@/lib/aps/workflow";
import { useRfiData } from "@/lib/aps/use-rfi-data";
import { applyTemplate } from "@/lib/report/apply";
import { exportReport } from "@/lib/report/export";
import { emptyTemplate, type ReportTemplate } from "@/lib/report/types";
import { FieldPicker } from "@/components/builder/field-picker";
import { FilterBuilder } from "@/components/builder/filter-builder";
import { SortPicker } from "@/components/builder/sort-picker";
import { OutputPicker } from "@/components/builder/output-picker";
import { TemplatePanel } from "@/components/builder/template-panel";
import { Preview } from "@/components/builder/preview";
import { Button } from "@/components/ui/button";

function BuilderInner() {
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
  const [template, setTemplate] = useState<ReportTemplate | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportErr, setExportErr] = useState<string | null>(null);

  useEffect(() => {
    if (projectId && !template) setTemplate(emptyTemplate(projectId));
  }, [projectId, template]);

  const rfisWithLabels = useMemo(() => {
    if (!workflow.length) return rfis;
    const map = buildStatusLabelMap(workflow);
    return rfis.map((r) =>
      r.statusLabel ? r : map.get(r.status) ? { ...r, statusLabel: map.get(r.status) } : r,
    );
  }, [rfis, workflow]);

  const applied = useMemo(() => {
    if (!template) return null;
    return applyTemplate(rfisWithLabels, template, attrs);
  }, [rfisWithLabels, template, attrs]);

  async function onExport() {
    if (!template) return;
    setExporting(true);
    setExportErr(null);
    try {
      // If the user picked the Detail layout with comments and we haven't
      // hydrated comments yet, do that now so the PDF actually has them.
      const wantsComments =
        template.pdfLayout === "detail" && (template.detailIncludeComments ?? false);
      const haveComments = rfisWithLabels.some((r) => r.comments && r.comments.length > 0);
      let dataset = rfisWithLabels;
      if (wantsComments && !haveComments) {
        const refreshed = await hydrate({ comments: true });
        if (refreshed) dataset = refreshed;
      }
      await exportReport({
        template,
        rfis: dataset,
        customAttributes: attrs,
        projectName: projectName ?? projectId,
        projectId,
      });
    } catch (e) {
      setExportErr(e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  }

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

  if (!template) {
    return <p className="text-sm text-neutral-500">Preparing builder…</p>;
  }

  const exportReady = !isLoading && !isError && template.fields.length > 0 && rfis.length > 0;

  const isRateLimited = /\b429\b|rate[- ]?limit/i.test(
    error instanceof Error ? error.message : "",
  );

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-[color:var(--brand-border)] bg-white p-5 shadow-card sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--brand-secondary)]">
              Report builder
            </p>
            <h2 className="mt-1 truncate text-xl font-semibold text-[color:var(--brand-primary)] sm:text-2xl">
              {projectName ?? "Project"}
            </h2>
            <p className="mt-2 text-sm text-[color:var(--brand-muted)]">
              {isLoading
                ? "Loading RFIs…"
                : `${rfis.length.toLocaleString()} ${rfis.length === 1 ? "RFI" : "RFIs"} loaded`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/rfis?hubId=${encodeURIComponent(hubId)}&projectId=${encodeURIComponent(projectId)}`}
              className="text-sm font-medium text-[color:var(--brand-secondary)] underline-offset-4 hover:underline"
            >
              ← Back to RFIs
            </Link>
            <Button
              size="md"
              disabled={!exportReady || exporting}
              onClick={onExport}
            >
              {exporting ? "Generating…" : `Export ${template.output.toUpperCase()}`}
            </Button>
          </div>
        </div>
        <div
          aria-hidden
          className="mt-5 h-1 w-16 rounded-full bg-[color:var(--brand-accent)]"
        />
      </div>

      {exportErr ? (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          Export failed: {exportErr}
        </p>
      ) : null}

      {isError ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <p className="font-semibold">
            {isRateLimited
              ? "Forma is rate-limiting this project"
              : "Failed to load project data"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-red-700/90">
            {isRateLimited
              ? "Large projects can hit Autodesk's burst limits. The app already retries automatically — wait a minute and try again, or apply tighter filters before loading."
              : error instanceof Error
                ? error.message
                : "Try refreshing this page."}
          </p>
        </div>
      ) : null}

      {!isLoading && !isError && (shouldHydrate || hydrating || hydrated) ? (
        <div className="rounded-xl border border-[color:var(--brand-secondary)]/20 bg-[color:var(--brand-secondary)]/5 px-4 py-3 text-sm text-[color:var(--brand-secondary)]">
          {hydrated ? (
            <p className="font-semibold">
              Loaded full RFI detail — custom fields are now selectable.
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
                  Fetch each RFI&apos;s full detail individually so custom
                  fields appear in the field picker, filters, and exported
                  reports.
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

      {attrsMissingTitles || workflowMissing ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Limited project metadata</p>
          <ul className="mt-1 list-disc pl-5 text-xs">
            {attrsMissingTitles ? (
              <li>
                One or more custom-field titles couldn&apos;t be resolved. Those
                columns use the raw attribute id as the header. Filtering and
                export still work.
              </li>
            ) : null}
            {workflowMissing ? (
              <li>Workflow labels unavailable — status columns show raw IDs.</li>
            ) : null}
          </ul>
        </div>
      ) : null}

      <TemplatePanel
        projectId={projectId}
        template={template}
        onTemplateChange={setTemplate}
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        <FieldPicker
          fields={template.fields}
          onChange={(fields) => setTemplate({ ...template, fields })}
          customAttributes={attrs}
        />
        <FilterBuilder
          filter={template.filter}
          onChange={(filter) => setTemplate({ ...template, filter })}
          customAttributes={attrs}
          workflow={workflow}
        />
        <div className="space-y-6 md:col-span-2 xl:col-span-1">
          <SortPicker
            sort={template.sort}
            onChange={(sort) => setTemplate({ ...template, sort })}
            groupBy={template.groupBy}
            onGroupByChange={(groupBy) => setTemplate({ ...template, groupBy })}
            customAttributes={attrs}
          />
          <OutputPicker template={template} onChange={setTemplate} />
        </div>
      </div>

      {applied ? (
        <Preview
          groups={applied.groups}
          fields={template.fields}
          customAttributes={attrs}
          totalBeforeFilter={applied.totalBeforeFilter}
          totalAfterFilter={applied.filtered.length}
        />
      ) : null}
    </section>
  );
}

export default function BuilderPage() {
  return (
    <Suspense fallback={<p className="text-sm text-neutral-500">Loading…</p>}>
      <BuilderInner />
    </Suspense>
  );
}
