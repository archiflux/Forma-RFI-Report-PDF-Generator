"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  applyUserRoster,
  hydrateRfis,
  type HydrationProgress,
  listCustomAttributes,
  mergeCustomAttributes,
  rfisHaveCustomAttributes,
  scrapeAllRfis,
} from "./rfis";
import { getProjectName } from "./projects";
import { buildUserRoster, getProjectUsers } from "./users";
import { getWorkflow } from "./workflow";
import { useApsClient } from "./use-client";
import type { Rfi } from "./types";

// 10 minutes — RFIs don't change that fast and the user is about to export them.
const STALE_MS = 10 * 60_000;
const PROJECT_META_STALE_MS = 60 * 60_000; // user roster + name barely change

const HYDRATED_KEY = (projectId: string) => ["rfis-hydrated", projectId] as const;

export function useRfiData(projectId: string, hubId?: string) {
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

  // Project user roster — used to resolve assignedTo[] ids to display names.
  const usersQ = useQuery({
    queryKey: ["project-users", projectId],
    queryFn: () => getProjectUsers(client, projectId),
    enabled,
    staleTime: PROJECT_META_STALE_MS,
  });

  // Project display name — used in the PDF cover/footer and the page header.
  const projectNameQ = useQuery({
    queryKey: ["project-name", hubId, projectId],
    queryFn: () => getProjectName(client, hubId ?? "", projectId),
    enabled: enabled && Boolean(hubId),
    staleTime: PROJECT_META_STALE_MS,
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
  const baseOrHydrated = hydratedQ.data ?? baseRfis;

  // Fold the user roster into RFIs once both queries have settled.
  const userRoster = useMemo(
    () => buildUserRoster(usersQ.data ?? []),
    [usersQ.data],
  );
  const rfis = useMemo(
    () => applyUserRoster(baseOrHydrated, userRoster),
    [baseOrHydrated, userRoster],
  );

  const mergedAttrs = useMemo(
    () => mergeCustomAttributes(attrsQ.data ?? [], rfis),
    [attrsQ.data, rfis],
  );

  const attrsMissingTitles = mergedAttrs.some((a) => a.inferred && a.name === a.id);
  const workflowMissing = (workflowQ.data ?? []).length === 0 && Boolean(baseRfis.length);

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
    projectName: projectNameQ.data,
    userRoster,
    isLoading: rfisQ.isLoading || attrsQ.isLoading || workflowQ.isLoading,
    isError: rfisQ.isError,
    error: rfisQ.error,
    attrsMissingTitles,
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
