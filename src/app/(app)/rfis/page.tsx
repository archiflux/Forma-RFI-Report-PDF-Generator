"use client";

import Link from "next/link";
import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { buildStatusLabelMap } from "@/lib/aps/workflow";
import { useRfiData } from "@/lib/aps/use-rfi-data";
import { RfiGrid } from "@/components/rfi-grid";
import { Button } from "@/components/ui/button";

function MetadataBanner({
  attrsInferred,
  workflowMissing,
}: {
  attrsInferred: boolean;
  workflowMissing: boolean;
}) {
  if (!attrsInferred && !workflowMissing) return null;
  return (
    <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <p className="font-medium">Limited project metadata</p>
      <ul className="mt-1 list-disc pl-5 text-xs">
        {attrsInferred ? (
          <li>
            Custom-attribute <strong>definitions</strong> are hidden by Forma
            (usually because you don&apos;t have <em>Manage Custom Attributes</em>
            permission on this project). Columns for custom fields show their
            raw IDs and values instead of friendly names. RFIs, custom values,
            and export all still work.
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
    attrsInferred,
    workflowMissing,
  } = useRfiData(projectId);

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

  return (
    <section>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">RFIs</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Project{" "}
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
            disabled={isLoading || rfis.length === 0}
            onClick={() => {
              const qs = new URLSearchParams({ hubId, projectId }).toString();
              window.location.assign(`/builder?${qs}`);
            }}
          >
            Build report →
          </Button>
        </div>
      </div>

      <MetadataBanner attrsInferred={attrsInferred} workflowMissing={workflowMissing} />

      {isLoading ? (
        <div className="mt-6 rounded-xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
          <p className="text-sm font-medium">Loading RFIs…</p>
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
        <RfiGrid rfis={rfis} customAttributes={attrs} statusLabels={statusLabels} />
      ) : null}
    </section>
  );
}

export default function RfisPage() {
  return (
    <Suspense fallback={<p className="text-sm text-neutral-500">Loading…</p>}>
      <RfisInner />
    </Suspense>
  );
}
