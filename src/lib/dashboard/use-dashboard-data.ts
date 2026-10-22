"use client";

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { useApsClient } from "@/lib/aps/use-client";
import { getIssueLookups, getLocationNames, scrapeRawIssues } from "@/lib/aps/issues-meta";
import { listIssueCustomAttributes } from "@/lib/aps/issues";
import { getProjectDirectory, type ProjectDirectory } from "@/lib/aps/users";
import type { ApsClient } from "@/lib/aps/client";
import { ApsError } from "@/lib/aps/types";
import { normaliseIssue } from "./normalise";
import type { DashboardDataset, DatasetProject, IssueRecord } from "./types";

const STALE_MS = 10 * 60_000;

interface ProjectLoad {
  project: DatasetProject;
  issues: IssueRecord[];
}

async function loadProject(
  client: ApsClient,
  project: { id: string; name: string },
): Promise<ProjectLoad> {
  let raw: unknown[];
  try {
    raw = await scrapeRawIssues(client, project.id);
  } catch (e) {
    // 404 = Issues tool not activated in this project. Skip the lookups.
    if (e instanceof ApsError && e.status === 404) {
      return { project: { id: project.id, name: project.name, issueCount: 0, issuesUnavailable: true }, issues: [] };
    }
    throw e;
  }
  const emptyDir: ProjectDirectory = { people: new Map(), companies: new Map(), roles: new Map() };
  const [lookups, directory, attrs, locations] = await Promise.all([
    getIssueLookups(client, project.id),
    getProjectDirectory(client, project.id).catch(() => emptyDir),
    listIssueCustomAttributes(client, project.id).catch(() => []),
    getLocationNames(client, project.id).catch(() => ({})),
  ]);
  const ctx = {
    projectId: project.id,
    projectName: project.name,
    lookups,
    directory,
    attrs: Object.fromEntries(
      attrs.map((a) => [a.id, { name: a.name, options: Object.fromEntries((a.values ?? []).map((v) => [v.id, v.label])) }]),
    ),
    locations,
  };
  const issues = raw.flatMap((r) => {
    const n = normaliseIssue(r, ctx);
    return n ? [n] : [];
  });
  return {
    project: { id: project.id, name: project.name, issueCount: issues.length, memberCount: directory.people.size },
    issues,
  };
}

// Loads Issues for every selected project in parallel (TanStack Query caps
// nothing here, but the ApsClient retries 429s with backoff) and merges them
// into one DashboardDataset. A project that fails is reported, not fatal.
export function useDashboardData(hubId: string, projects: Array<{ id: string; name: string }>) {
  const client = useApsClient();
  const results = useQueries({
    queries: projects.map((p) => ({
      queryKey: ["dashboard-project", p.id],
      queryFn: () => loadProject(client, p),
      staleTime: STALE_MS,
    })),
  });

  const loading = results.filter((r) => r.isLoading).length;
  const dataKey = results.map((r) => r.dataUpdatedAt).join(",");

  const dataset = useMemo<DashboardDataset>(() => {
    const outProjects: DatasetProject[] = [];
    const issues: IssueRecord[] = [];
    results.forEach((r, idx) => {
      const p = projects[idx];
      if (!p) return;
      if (r.data) {
        outProjects.push(r.data.project);
        issues.push(...r.data.issues);
      } else {
        outProjects.push({
          id: p.id,
          name: p.name,
          issueCount: 0,
          ...(r.error ? { error: r.error instanceof Error ? r.error.message : String(r.error) } : {}),
        });
      }
    });
    return { version: 1, generatedAt: new Date().toISOString(), hubId, projects: outProjects, issues };
    // results identity changes every render; dataKey captures real updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey, hubId, projects, loading]);

  return { dataset, loading, total: projects.length };
}
