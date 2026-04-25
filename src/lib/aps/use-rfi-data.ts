"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  hydrateRfis,
  type HydrationProgress,
  listCustomAttributes,
  mergeCustomAttributes,
  rfisHaveCustomAttributes,
  scrapeAllRfis,
} from "./rfis";
import { getWorkflow } from "./workflow";
import { useApsClient } from "./use-client";
import type { Rfi } from "./types";

// 10 minutes — RFIs don't change that fast and the user is about to export them.
const STALE_MS = 10 * 60_000;

const HYDRATED_KEY = (projectId: string) => ["rfis-hydrated", projectId] as const;

export function useRfiData(projectId: string) {
  const client = useApsClient();
  const qc = useQueryClient();
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

  // Hydrated copy — populated by hydrate() below, never auto-fetched.
  const hydratedQ = useQuery<Rfi[]>({
    queryKey: HYDRATED_KEY(projectId),
    enabled: false,
    staleTime: STALE_MS,
  });

  const [hydrationProgress, setHydrationProgress] = useState<HydrationProgress | null>(null);
  const [hydrating, setHydrating] = useState(false);
  const [hydrateError, setHydrateError] = useState<string | null>(null);

  const baseRfis = rfisQ.data ?? [];
  const rfis = hydratedQ.data ?? baseRfis;

  const mergedAttrs = useMemo(
    () => mergeCustomAttributes(attrsQ.data ?? [], rfis),
    [attrsQ.data, rfis],
  );

  const attrsInferred = mergedAttrs.some((a) => a.inferred);
  const workflowMissing = (workflowQ.data ?? []).length === 0 && Boolean(baseRfis.length);

  // True when search:rfis returned RFIs but none carry customAttributes —
  // the signal that hydration would actually add information.
  const searchHasCustomAttrs = rfisHaveCustomAttributes(baseRfis);
  const canHydrate = baseRfis.length > 0 && !hydratedQ.data && !hydrating;
  const shouldHydrate = canHydrate && !searchHasCustomAttrs;

  async function hydrate() {
    if (!projectId || !baseRfis.length) return;
    setHydrating(true);
    setHydrateError(null);
    setHydrationProgress({ hydrated: 0, total: baseRfis.length });
    try {
      const full = await hydrateRfis(client, projectId, baseRfis, (p) =>
        setHydrationProgress(p),
      );
      qc.setQueryData(HYDRATED_KEY(projectId), full);
    } catch (e) {
      setHydrateError(e instanceof Error ? e.message : String(e));
    } finally {
      setHydrating(false);
    }
  }

  return {
    rfis,
    attrs: mergedAttrs,
    workflow: workflowQ.data ?? [],
    isLoading: rfisQ.isLoading || attrsQ.isLoading || workflowQ.isLoading,
    isError: rfisQ.isError,
    error: rfisQ.error,
    attrsInferred,
    workflowMissing,

    canHydrate,
    shouldHydrate,
    hydrating,
    hydrationProgress,
    hydrateError,
    hydrated: Boolean(hydratedQ.data),
    hydrate,
  };
}
