import type { ApsClient } from "./client";
import { normaliseProjectIdForRfi } from "./projects";

export interface MeInfo {
  id: string;
  email?: string;
  name?: string;
  roles: string[];
}

interface RawMeResponse {
  id?: string;
  email?: string;
  name?: string;
  displayName?: string;
  roles?: Array<string | { name?: string; id?: string }>;
}

export async function getMe(client: ApsClient, projectId: string): Promise<MeInfo> {
  const p = normaliseProjectIdForRfi(projectId);
  const res = await client.request<RawMeResponse>({
    path: `/construction/rfis/v3/projects/${encodeURIComponent(p)}/users/me`,
  });
  const roles = (res.roles ?? []).map((r) =>
    typeof r === "string" ? r : r.name ?? r.id ?? "",
  );
  return {
    id: res.id ?? "",
    email: res.email,
    name: res.name ?? res.displayName,
    roles: roles.filter(Boolean),
  };
}
