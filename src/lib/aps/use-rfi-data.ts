"use client";

import { useQuery } from "@tanstack/react-query";
import { listCustomAttributes, scrapeAllRfis } from "./rfis";
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

  return {
    rfis: rfisQ.data ?? [],
    attrs: attrsQ.data ?? [],
    workflow: workflowQ.data ?? [],
    isLoading: rfisQ.isLoading || attrsQ.isLoading || workflowQ.isLoading,
    isError: rfisQ.isError || attrsQ.isError || workflowQ.isError,
    error: rfisQ.error ?? attrsQ.error ?? workflowQ.error,
  };
}
