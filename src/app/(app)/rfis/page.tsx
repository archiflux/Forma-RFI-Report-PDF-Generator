"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useApsClient } from "@/lib/aps/use-client";
import { listCustomAttributes, scrapeAllRfis } from "@/lib/aps/rfis";
import { buildStatusLabelMap, getWorkflow } from "@/lib/aps/workflow";
import type { Rfi, RfiScrapeProgress } from "@/lib/aps/types";
import { RfiGrid } from "@/components/rfi-grid";
import { Button } from "@/components/ui/button";

function RfisInner() {
  const params = useSearchParams();
  const hubId = params.get("hubId") ?? "";
  const projectId = params.get("projectId") ?? "";
  const client = useApsClient();

  const attrsQ = useQuery({
    queryKey: ["attrs", projectId],
    queryFn: () => listCustomAttributes(client, projectId),
    enabled: Boolean(projectId),
  });

  const workflowQ = useQuery({
    queryKey: ["workflow", projectId],
    queryFn: () => getWorkflow(client, projectId),
    enabled: Boolean(projectId),
  });

  const [progress, setProgress] = useState<RfiScrapeProgress | null>(null);
  const [rfis, setRfis] = useState<Rfi[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    const ac = new AbortController();
    setRunning(true);
    setErr(null);
    setProgress(null);
    setRfis(null);

    scrapeAllRfis(client, projectId, undefined, undefined, (p) => setProgress(p), ac.signal)
      .then((all) => {
        setRfis(all);
        setRunning(false);
      })
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name === "AbortError") return;
        setErr(e instanceof Error ? e.message : String(e));
        setRunning(false);
      });

    return () => ac.abort();
  }, [client, projectId]);

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

  const statusLabels = workflowQ.data ? buildStatusLabelMap(workflowQ.data) : undefined;
  const attrs = attrsQ.data ?? [];

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
            disabled={!rfis || running}
            onClick={() => {
              const qs = new URLSearchParams({ hubId, projectId }).toString();
              window.location.assign(`/builder?${qs}`);
            }}
          >
            Build report →
          </Button>
        </div>
      </div>

      {running ? (
        <div className="mt-6 rounded-xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
          <p className="text-sm font-medium">Loading RFIs…</p>
          <p className="mt-1 text-xs text-neutral-500">
            {progress?.loaded.toLocaleString() ?? 0}
            {progress?.total ? ` of ${progress.total.toLocaleString()}` : ""} fetched
          </p>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded bg-neutral-100">
            <div
              className="h-full bg-[color:var(--brand-primary)] transition-[width]"
              style={{
                width:
                  progress?.total && progress.loaded
                    ? `${Math.min(100, (progress.loaded / progress.total) * 100)}%`
                    : "15%",
              }}
            />
          </div>
        </div>
      ) : null}

      {err ? (
        <p role="alert" className="mt-6 text-sm text-red-600">
          {err}
        </p>
      ) : null}

      {rfis ? (
        <RfiGrid
          rfis={rfis}
          customAttributes={attrs}
          statusLabels={statusLabels}
        />
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
