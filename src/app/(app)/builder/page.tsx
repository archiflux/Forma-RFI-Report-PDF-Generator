"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { buildStatusLabelMap } from "@/lib/aps/workflow";
import { useRfiData } from "@/lib/aps/use-rfi-data";
import { applyTemplate } from "@/lib/report/apply";
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

  const { rfis, attrs, workflow, isLoading, isError, error } = useRfiData(projectId);
  const [template, setTemplate] = useState<ReportTemplate | null>(null);

  // Initialise once we have a project.
  useEffect(() => {
    if (projectId && !template) setTemplate(emptyTemplate(projectId));
  }, [projectId, template]);

  // Resolve raw status ids → human labels on the RFIs so filters that test
  // the label (rather than the id) work intuitively.
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

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Report builder</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Project{" "}
            <code className="rounded bg-neutral-100 px-1">{projectId}</code>
            {isLoading ? " · loading RFIs…" : ` · ${rfis.length.toLocaleString()} RFIs loaded`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/rfis?hubId=${encodeURIComponent(hubId)}&projectId=${encodeURIComponent(projectId)}`}
            className="text-sm text-neutral-500 underline"
          >
            Back to RFIs
          </Link>
          <Button
            size="md"
            disabled
            title="Export lands in Phase 4 (PDF + CSV)"
          >
            Export → {template.output.toUpperCase()}
          </Button>
        </div>
      </div>

      {isError ? (
        <p role="alert" className="text-sm text-red-600">
          {error instanceof Error ? error.message : "Failed to load project data."}
        </p>
      ) : null}

      <TemplatePanel
        projectId={projectId}
        template={template}
        onTemplateChange={setTemplate}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
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
        <div className="space-y-6">
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

      <p className="text-xs text-neutral-500">
        Export is disabled until Phase 4 ships. Templates you save here will be
        ready to export as soon as it does.
      </p>
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
