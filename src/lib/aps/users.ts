import type { ApsClient } from "./client";
import { ApsError } from "./types";
import { normaliseProjectIdForRfi } from "./projects";

export interface ProjectUser {
  id: string;
  name: string;
  email?: string;
}

interface RawProjectUser {
  id?: string;
  autodeskId?: string;
  email?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
}

interface RawProjectUsersResponse {
  results?: RawProjectUser[];
  pagination?: { limit?: number; offset?: number; totalResults?: number };
}

const PAGE = 100;
const MAX_TOTAL = 5000;

// GET /construction/admin/v1/projects/:p/users — paginated user roster.
// Returns id + display name for every member of the project, which we use
// to resolve assignedTo[] references (which are id-only) into named parties.
export async function getProjectUsers(
  client: ApsClient,
  projectId: string,
): Promise<ProjectUser[]> {
  const p = normaliseProjectIdForRfi(projectId);
  const out: ProjectUser[] = [];
  let offset = 0;
  for (;;) {
    let res: RawProjectUsersResponse;
    try {
      res = await client.request<RawProjectUsersResponse>({
        path: `/construction/admin/v1/projects/${encodeURIComponent(p)}/users`,
        query: { limit: PAGE, offset },
      });
    } catch (e) {
      // Member listing is permission-gated. Non-admins commonly hit 403.
      // Degrade silently so unresolved-id assignees still appear.
      if (e instanceof ApsError && (e.status === 401 || e.status === 403)) {
        return out;
      }
      throw e;
    }
    const page = (res.results ?? []).map(normalizeUser);
    out.push(...page);
    if (page.length < PAGE) break;
    offset += PAGE;
    if (out.length >= MAX_TOTAL) break;
  }
  return out;
}

function normalizeUser(raw: RawProjectUser): ProjectUser {
  const id = raw.id ?? raw.autodeskId ?? "";
  const composed =
    [raw.firstName, raw.lastName].filter((s) => typeof s === "string" && s.length).join(" ") ||
    undefined;
  const name = raw.name ?? composed ?? raw.email ?? id;
  return { id, name, email: raw.email };
}

export function buildUserRoster(users: ProjectUser[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const u of users) {
    if (u.id && u.name) out.set(u.id, u.name);
  }
  return out;
}
