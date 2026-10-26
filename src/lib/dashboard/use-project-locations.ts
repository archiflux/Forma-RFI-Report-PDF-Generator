"use client";

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { useApsClient } from "@/lib/aps/use-client";
import { getProjectLocation, type ProjectLocation } from "@/lib/aps/project-location";

// Project id -> coordinates for the selected projects (null when unknown).
export function useProjectLocations(projects: Array<{ id: string }>): Record<string, ProjectLocation | null> {
  const client = useApsClient();
  const results = useQueries({
    queries: projects.map((p) => ({
      queryKey: ["project-location", p.id],
      queryFn: () => getProjectLocation(client, p.id),
      staleTime: 24 * 60 * 60_000,
    })),
  });
  const key = results.map((r) => r.dataUpdatedAt).join(",");
  return useMemo(
    () => Object.fromEntries(projects.map((p, i) => [p.id, results[i]?.data ?? null])),
    // results identity changes every render; key captures real updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, projects],
  );
}
