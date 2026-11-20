import type { ApsClient } from "./client";
import { ApsError, type Rfi } from "./types";
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
//
// The construction-admin endpoint is admin-gated. When it 401/403s (every
// non-admin user), we fall back to /bim360/admin/v1/projects/:p/users which
// is readable by any project member. The two endpoints return the same
// shape modulo id-keying — we tolerate that in normalizeUser.
export async function getProjectUsers(
  client: ApsClient,
  projectId: string,
): Promise<ProjectUser[]> {
  const p = normaliseProjectIdForRfi(projectId);
  const primary = await tryFetchUsers(
    client,
    `/construction/admin/v1/projects/${encodeURIComponent(p)}/users`,
  );
  if (primary !== "denied") return primary;
  // Fallback for non-admins. Same path under the bim360-admin namespace
  // permits any project member to enumerate fellow members.
  const fallback = await tryFetchUsers(
    client,
    `/bim360/admin/v1/projects/${encodeURIComponent(p)}/users`,
  );
  return fallback === "denied" ? [] : fallback;
}

async function tryFetchUsers(
  client: ApsClient,
  path: string,
): Promise<ProjectUser[] | "denied"> {
  const out: ProjectUser[] = [];
  let offset = 0;
  for (;;) {
    let res: RawProjectUsersResponse;
    try {
      res = await client.request<RawProjectUsersResponse>({
        path,
        query: { limit: PAGE, offset },
      });
    } catch (e) {
      if (e instanceof ApsError && (e.status === 401 || e.status === 403 || e.status === 404)) {
        // 404 means the endpoint doesn't exist on this tenant — same
        // outcome from the caller's perspective.
        return out.length > 0 ? out : "denied";
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

// Scrape display names out of @{...} mentions embedded in comment bodies.
//
// ACC renders @-mentions in comments by inlining a JSON blob like
//   @{"type": "user", "id": "NBM2Z2GMMZBK6RR4", "name": "Richard Bowdler"}
// When a user is later removed from the project, the admin user-roster
// endpoint drops them, so comments they left render as the raw UUID (or
// "Unknown"). Their name is still readable in every mention that another
// user made of them — this walks every comment body and harvests a
// fallback id → name map we merge into the main roster.
const MENTION_RE = /@\{[^}]*\}/g;

interface MentionShape {
  type?: string;
  id?: string;
  name?: string;
  displayName?: string;
}

export function scrapeMentionRoster(rfis: Rfi[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const r of rfis) {
    const comments = r.comments;
    if (!comments || comments.length === 0) continue;
    for (const c of comments) {
      const body = c.body;
      if (!body) continue;
      const matches = body.match(MENTION_RE);
      if (!matches) continue;
      for (const raw of matches) {
        // raw looks like '@{"type":"user","id":"...","name":"..."}'
        const json = raw.slice(1);
        let parsed: MentionShape;
        try {
          parsed = JSON.parse(json) as MentionShape;
        } catch {
          continue;
        }
        const id = parsed?.id;
        const name = parsed?.name ?? parsed?.displayName;
        if (typeof id === "string" && id && typeof name === "string" && name) {
          if (!out.has(id)) out.set(id, name);
        }
      }
    }
  }
  return out;
}

// Render a comment body with its inline @{...} JSON mention blobs replaced
// by human-readable "@Name" tokens. Falls back to "@<id>" when the mention
// payload omits a name, and strips the blob entirely for malformed JSON.
export function renderCommentBody(body: string | undefined): string {
  if (!body) return "";
  return body.replace(MENTION_RE, (raw) => {
    const json = raw.slice(1);
    try {
      const parsed = JSON.parse(json) as MentionShape;
      const name = parsed?.name ?? parsed?.displayName;
      if (typeof name === "string" && name) return `@${name}`;
      if (typeof parsed?.id === "string" && parsed.id) return `@${parsed.id}`;
    } catch {
      // Not a mention blob — drop it rather than leak raw JSON.
    }
    return "";
  });
}

// Combine two rosters; the primary (passed first) wins on key collisions.
// Used to layer the mention-scraped fallback under the admin-endpoint
// roster without letting a stale mention overwrite an authoritative name.
export function mergeRosters(
  primary: ReadonlyMap<string, string>,
  fallback: ReadonlyMap<string, string>,
): Map<string, string> {
  const out = new Map(primary);
  for (const [k, v] of fallback) {
    if (!out.has(k)) out.set(k, v);
  }
  return out;
}
