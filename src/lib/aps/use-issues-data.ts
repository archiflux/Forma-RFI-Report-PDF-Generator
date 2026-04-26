"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  hydrateIssues,
  type IssueHydrationProgress,
  listIssueCustomAttributes,
  scrapeAllIssues,
} from "./issues";
import {
  applyUserRoster,
  mergeCustomAttributes,
  rfisHaveCustomAttributes,
} from "./rfis";
import { getProjectName } from "./projects";
import { buildUserRoster, getProjectUsers } from "./users";
import { useApsClient } from "./use-client";
import type { Rfi } from "./types";

const STALE_MS = 10 * 60_000;
const PROJECT_META_STALE_MS = 60 * 60_000;

const HYDRATED_KEY = (projectId: string) => ["issues-hydrated", projectId] as const;

export function useIssuesData(projectId: string, hubId?: string) {
  const client = useApsClient();
  const qc = useQueryClient();
  const enabled = Boolean(projectId);

  const itemsQ = useQuery({
    queryKey: ["issues", projectId],
    queryFn: () => scrapeAllIssues(client, projectId),
    enabled,
    staleTime: STALE_MS,
  });

  const attrsQ = useQuery({
    queryKey: ["issue-attrs", projectId],
    queryFn: () => listIssueCustomAttributes(client, projectId),
    enabled,
    staleTime: STALE_MS,
  });

  const usersQ = useQuery({
    queryKey: ["project-users", projectId],
    queryFn: () => getProjectUsers(client, projectId),
    enabled,
    staleTime: PROJECT_META_STALE_MS,
  });

  const projectNameQ = useQuery({
    queryKey: ["project-name", hubId, projectId],
    queryFn: () => getProjectName(client, hubId ?? "", projectId),
    enabled: enabled && Boolean(hubId),
    staleTime: PROJECT_META_STALE_MS,
  });

  const hydratedQ = useQuery<Rfi[]>({
    queryKey: HYDRATED_KEY(projectId),
    enabled: false,
    staleTime: STALE_MS,
  });

  const [hydrationProgress, setHydrationProgress] = useState<IssueHydrationProgress | null>(null);
  const [hydrating, setHydrating] = useState(false);
  const [hydrateError, setHydrateError] = useState<string | null>(null);

  const baseItems = itemsQ.data ?? [];
  const baseOrHydrated = hydratedQ.data ?? baseItems;

  const userRoster = useMemo(
    () => buildUserRoster(usersQ.data ?? []),
    [usersQ.data],
  );
  const items = useMemo(
    () => applyUserRoster(baseOrHydrated, userRoster),
    [baseOrHydrated, userRoster],
  );

  const mergedAttrs = useMemo(
    () => mergeCustomAttributes(attrsQ.data ?? [], items),
    [attrsQ.data, items],
  );

  const attrsMissingTitles = mergedAttrs.some((a) => a.inferred && a.name === a.id);

  const searchHasCustomAttrs = rfisHaveCustomAttributes(baseItems);
  const canHydrate = baseItems.length > 0 && !hydratedQ.data && !hydrating;
  const shouldHydrate = canHydrate && !searchHasCustomAttrs;

  async function hydrate() {
    if (!projectId || !baseItems.length) return;
    setHydrating(true);
    setHydrateError(null);
    setHydrationProgress({ hydrated: 0, total: baseItems.length });
    try {
      const full = await hydrateIssues(client, projectId, baseItems, (p) =>
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
    items,
    attrs: mergedAttrs,
    projectName: projectNameQ.data,
    userRoster,
    isLoading: itemsQ.isLoading || attrsQ.isLoading,
    isError: itemsQ.isError,
    error: itemsQ.error,
    attrsMissingTitles,

    canHydrate,
    shouldHydrate,
    hydrating,
    hydrationProgress,
    hydrateError,
    hydrated: Boolean(hydratedQ.data),
    hydrate,
  };
}
