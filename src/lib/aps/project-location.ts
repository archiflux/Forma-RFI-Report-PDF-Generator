// Project coordinates from the ACC Admin API (GET). Returns null when the
// project has no coordinates or the caller can't read project details.

import type { ApsClient } from "./client";
import { normaliseProjectIdForRfi } from "./projects";

export interface ProjectLocation {
  lat: number;
  lon: number;
  city?: string;
}

interface RawProject {
  latitude?: string | number | null;
  longitude?: string | number | null;
  city?: string | null;
}

export function parseLocation(r: RawProject): ProjectLocation | null {
  const lat = Number(r.latitude);
  const lon = Number(r.longitude);
  if (r.latitude === null || r.latitude === undefined || r.latitude === "" || r.longitude === null || r.longitude === undefined || r.longitude === "") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  // 0,0 is a placeholder, not a project in the Gulf of Guinea.
  if (lat === 0 && lon === 0) return null;
  return { lat, lon, ...(r.city ? { city: r.city } : {}) };
}

export async function getProjectLocation(client: ApsClient, projectId: string): Promise<ProjectLocation | null> {
  try {
    const r = await client.request<RawProject>({
      path: `/construction/admin/v1/projects/${encodeURIComponent(normaliseProjectIdForRfi(projectId))}`,
    });
    return parseLocation(r);
  } catch {
    return null;
  }
}
