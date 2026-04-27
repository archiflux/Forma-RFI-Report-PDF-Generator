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

function normalizeUser(raw: RawProjectUser): ProjectUser & { autodeskId?: string } {
  const id = raw.id ?? raw.autodeskId ?? "";
  const composed =
    [raw.firstName, raw.lastName].filter((s) => typeof s === "string" && s.length).join(" ") ||
    undefined;
  const name = raw.name ?? composed ?? raw.email ?? id;
  return { id, name, email: raw.email, autodeskId: raw.autodeskId };
}

// Build a roster keyed by EVERY id we have for each user. APS RFI v3 references
// users by their Autodesk Oxygen id (assignedTo[].id), but the project-users
// endpoint returns both that id AND a separate construction-side id. Without
// keying by both, half the references stay unresolved.
export function buildUserRoster(users: ProjectUser[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const u of users) {
    const enriched = u as ProjectUser & { autodeskId?: string };
    if (!enriched.name) continue;
    if (enriched.id) out.set(enriched.id, enriched.name);
    if (enriched.autodeskId && !out.has(enriched.autodeskId)) {
      out.set(enriched.autodeskId, enriched.name);
    }
    // Email is a useful tertiary key for fallbacks.
    if (enriched.email && !out.has(enriched.email)) {
      out.set(enriched.email, enriched.name);
    }
  }
  return out;
}
