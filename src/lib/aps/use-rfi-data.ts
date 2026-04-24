"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { listCustomAttributes, mergeCustomAttributes, scrapeAllRfis } from "./rfis";
import { getWorkflow } from "./workflow";
import { useApsClient } from "./use-client";

// 10 minutes — RFIs don't change that fast and the user is about to export them.
const STALE_MS = 10 * 60_000;

export function useRfiData(projectId: string) {
  const client = useApsClient();
  const enabled = Boolean(projectId);

  const rfisQ = useQuery({
    queryKey: ["rfis", projectId],
    queryFn: () => scrapeAllRfis(client, projectId),
    enabled,
    staleTime: STALE_MS,
  });

  const attrsQ = useQuery({
    queryKey: ["attrs", projectId],
    queryFn: () => listCustomAttributes(client, projectId),
    enabled,
    staleTime: STALE_MS,
  });

  const workflowQ = useQuery({
    queryKey: ["workflow", projectId],
    queryFn: () => getWorkflow(client, projectId),
    enabled,
    staleTime: STALE_MS,
  });

  // Merge fetched attr defs (full fidelity — real names, choice labels)
  // with inferred defs (id-only, derived from RFI payloads). The merge
  // returns something useful even when /attributes was blocked by a 403.
  const mergedAttrs = useMemo(
    () => mergeCustomAttributes(attrsQ.data ?? [], rfisQ.data ?? []),
    [attrsQ.data, rfisQ.data],
  );

  const attrsInferred = mergedAttrs.some((a) => a.inferred);
  const workflowMissing = (workflowQ.data ?? []).length === 0 && Boolean(rfisQ.data?.length);

  return {
    rfis: rfisQ.data ?? [],
    attrs: mergedAttrs,
    workflow: workflowQ.data ?? [],
    isLoading: rfisQ.isLoading || attrsQ.isLoading || workflowQ.isLoading,
    // RFI scrape is the only hard failure. Attrs/workflow degrading is
    // deliberately tolerated — see the flags below.
    isError: rfisQ.isError,
    error: rfisQ.error,
    attrsInferred,
    workflowMissing,
  };
}
