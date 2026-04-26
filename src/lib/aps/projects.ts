import type { ApsClient } from "./client";
import type { Project } from "./types";

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
  return (res.data ?? []).map((p) => ({
    id: p.id,
    hubId,
    name: p.attributes?.name ?? p.id,
  }));
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
