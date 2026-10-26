"use client";

import { useQuery } from "@tanstack/react-query";
import { useApsClient } from "@/lib/aps/use-client";
import { getUserProfile } from "@/lib/aps/user-profile";

// Who sees the Data probe. NEXT_PUBLIC_PROBE_USERS (comma-separated emails)
// replaces the default. This only hides a diagnostic page; the probe is
// read-only and every call still runs with the user's own permissions.
const DEFAULT_PROBE_USERS = ["j.henderson@baileyp.co.uk"];

export function probeUsers(raw = process.env.NEXT_PUBLIC_PROBE_USERS): string[] {
  const list = (raw ?? "").split(/[,;\s]+/).map((e) => e.trim().toLowerCase()).filter(Boolean);
  return list.length ? list : DEFAULT_PROBE_USERS;
}

export function canUseProbe(email: string | undefined, users = probeUsers()): boolean {
  return !!email && users.includes(email.toLowerCase());
}

export function useCanProbe(): { allowed: boolean; loading: boolean } {
  const client = useApsClient();
  const q = useQuery({ queryKey: ["user-profile"], queryFn: () => getUserProfile(client), staleTime: Infinity });
  return { allowed: canUseProbe(q.data?.email), loading: q.isLoading };
}
