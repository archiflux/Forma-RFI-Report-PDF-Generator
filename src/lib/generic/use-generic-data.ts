"use client";

import { useMemo } from "react";
import { keepPreviousData, useQueries } from "@tanstack/react-query";
import { useApsClient } from "@/lib/aps/use-client";
import type { ApsClient } from "@/lib/aps/client";
import { ApsError } from "@/lib/aps/types";
import type { BaseRecord, GenericDataset, GenericProject } from "./types";

const STALE_MS = 10 * 60_000;

export interface LoadOptions {
  // Fetch slower per-record detail as well (e.g. RFI custom fields).
  full: boolean;
  onProgress?: (done: number, total: number) => void;
}

export type ProjectLoader<T> = (client: ApsClient, project: { id: string; name: string }, opts: LoadOptions) => Promise<T[]>;

// Loads every selected project in parallel. A 404 from the module's API
// means the tool isn't switched on there, which is reported, not an error.
export function useGenericData<T extends BaseRecord>(
  kind: string,
  loader: ProjectLoader<T>,
  projects: Array<{ id: string; name: string }>,
  full = false,
  onProgress?: (projectId: string, done: number, total: number) => void,
) {
  const client = useApsClient();
  const results = useQueries({
    queries: projects.map((p) => ({
      queryKey: [`${kind}-project`, p.id, full ? "full" : "basic"],
      queryFn: async (): Promise<{ project: GenericProject; items: T[] }> => {
        try {
          const items = await loader(client, p, {
            full,
            ...(onProgress ? { onProgress: (d: number, t: number) => onProgress(p.id, d, t) } : {}),
          });
          return { project: { id: p.id, name: p.name, count: items.length }, items };
        } catch (e) {
          if (e instanceof ApsError && e.status === 404) {
            return { project: { id: p.id, name: p.name, count: 0, unavailable: true }, items: [] };
          }
          throw e;
        }
      },
      staleTime: STALE_MS,
      // Detail loads can take minutes; keep them for the whole session and
      // show the basic data while they run.
      gcTime: full ? Infinity : 5 * 60_000,
      placeholderData: keepPreviousData,
    })),
  });
  const loading = results.filter((r) => r.isLoading).length;
  // Includes reloads that are showing previous data meanwhile.
  const fetching = results.filter((r) => r.isFetching).length;
  const dataKey = results.map((r) => r.dataUpdatedAt).join(",");

  const dataset = useMemo<GenericDataset<T>>(() => {
    const out: GenericDataset<T> = { projects: [], items: [] };
    results.forEach((r, idx) => {
      const p = projects[idx];
      if (!p) return;
      if (r.data) {
        out.projects.push(r.data.project);
        out.items.push(...r.data.items);
      } else {
        out.projects.push({
          id: p.id,
          name: p.name,
          count: 0,
          ...(r.error ? { error: r.error instanceof Error ? r.error.message : String(r.error) } : {}),
        });
      }
    });
    return out;
    // results identity changes every render; dataKey captures real updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey, projects, loading]);

  return { dataset, loading, fetching, total: projects.length };
}
