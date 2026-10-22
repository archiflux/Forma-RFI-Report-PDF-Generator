import type { ApsClient } from "./client";

export interface UserProfile {
  userId: string;
  email?: string;
  name?: string;
}

interface RawProfile {
  userId?: string;
  emailId?: string;
  firstName?: string;
  lastName?: string;
}

// GET /userprofile/v1/users/@me — the signed-in Autodesk user. Needs the
// user-profile:read scope, which the app already requests.
export async function getUserProfile(client: ApsClient): Promise<UserProfile> {
  const r = await client.request<RawProfile>({ path: "/userprofile/v1/users/@me" });
  const name = [r.firstName, r.lastName].filter(Boolean).join(" ");
  return {
    userId: r.userId ?? "",
    ...(r.emailId ? { email: r.emailId } : {}),
    ...(name ? { name } : {}),
  };
}
