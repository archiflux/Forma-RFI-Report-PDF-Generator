import type { ApsClient } from "./client";
import type { Hub, Project } from "./types";
import { listHubs } from "./hubs";

interface RawProjectsResponse {
  data?: Array<{
    id: string;
    attributes?: { name?: string };
  }>;
}

export async function listProjects(
  client: ApsClient,
  hubId: string,
): Promise<Project[]> {
  const res = await client.request<RawProjectsResponse>({
    path: `/project/v1/hubs/${encodeURIComponent(hubId)}/projects`,
  });
  return sortByName(
    (res.data ?? []).map((p) => ({
      id: p.id,
      hubId,
      name: p.attributes?.name ?? p.id,
    })),
  );
}

// Every project the signed-in user can see, across all their Forma/ACC hubs
// (personal and unknown-type hubs are left out unless there are no others).
// Each project is tagged with its hub so the picker can show it. A hub that
// fails to list doesn't stop the others.
export async function listAllProjects(client: ApsClient): Promise<{ projects: Project[]; hubs: Hub[]; failedHubs: string[] }> {
  const all = await listHubs(client);
  const acc = all.filter((h) => h.kind === "acc");
  const hubs = acc.length ? acc : all.filter((h) => h.kind !== "personal");
  const failedHubs: string[] = [];
  const lists = await Promise.all(
    hubs.map((h) =>
      listProjects(client, h.id)
        .then((ps) => ps.map((p) => ({ ...p, hubName: h.name, ...(h.region ? { hubRegion: h.region } : {}) })))
        .catch(() => {
          failedHubs.push(h.name);
          return [] as Project[];
        }),
    ),
  );
  const seen = new Set<string>();
  const projects = sortByName(lists.flat().filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true))));
  return { projects, hubs, failedHubs };
}

// Alphabetical, numbers in natural order ("9 - X" before "10 - Y"),
// ignoring case. Every project list in the app comes through here.
export const projectCollator = new Intl.Collator("en-GB", { numeric: true, sensitivity: "base" });

export function sortByName<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => projectCollator.compare(a.name, b.name));
}

// ACC/Forma RFI endpoints expect the project id WITHOUT the leading "b." prefix
// that the Data Management API returns. This normaliser centralises that quirk
// (see SKILL.md §13 "Known gotchas").
export function normaliseProjectIdForRfi(projectId: string): string {
  return projectId.startsWith("b.") ? projectId.slice(2) : projectId;
}

interface RawSingleProjectResponse {
  data?: {
    id: string;
    attributes?: { name?: string };
  };
}

// Look up a single project's metadata without needing the hubId. Useful when
// we know the projectId from a deep link but not which hub it belongs to.
// Falls back to scanning every accessible hub if the targeted call fails.
export async function getProjectName(
  client: ApsClient,
  hubId: string,
  projectId: string,
): Promise<string | undefined> {
  if (!hubId || !projectId) return undefined;
  try {
    const res = await client.request<RawSingleProjectResponse>({
      path: `/project/v1/hubs/${encodeURIComponent(hubId)}/projects/${encodeURIComponent(projectId)}`,
    });
    return res.data?.attributes?.name;
  } catch {
    return undefined;
  }
}
