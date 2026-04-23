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
