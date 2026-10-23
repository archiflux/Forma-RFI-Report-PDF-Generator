// Data availability scan: for each project, how many records each tool
// holds. One request per tool per project with limit=1, reading the
// pagination total. GET except the read-shaped RFI search.

import type { ApsClient } from "./client";
import { normaliseProjectIdForRfi } from "./projects";
import { ApsError } from "./types";

export type ScanCell = number | "off" | "no access" | "error";

export const SCAN_TOOLS = ["Issues", "RFIs", "Forms", "Reviews", "Submittals"] as const;
export type ScanTool = (typeof SCAN_TOOLS)[number];

interface Paged {
  results?: unknown[];
  data?: unknown[];
  pagination?: { totalResults?: number };
}

function countOf(res: Paged): number {
  if (typeof res.pagination?.totalResults === "number") return res.pagination.totalResults;
  return (res.results ?? res.data ?? []).length;
}

async function cell(fn: () => Promise<Paged>): Promise<ScanCell> {
  try {
    return countOf(await fn());
  } catch (e) {
    if (e instanceof ApsError && e.status === 404) return "off";
    if (e instanceof ApsError && (e.status === 401 || e.status === 403)) return "no access";
    return "error";
  }
}

export async function scanProject(client: ApsClient, projectId: string): Promise<Record<ScanTool, ScanCell>> {
  const p = encodeURIComponent(normaliseProjectIdForRfi(projectId));
  const get = (path: string) => () => client.request<Paged>({ path, query: { limit: 1, offset: 0 } });
  const [Issues, RFIs, Forms, Reviews, Submittals] = await Promise.all([
    cell(get(`/construction/issues/v1/projects/${p}/issues`)),
    cell(() =>
      client.request<Paged>({ method: "POST", path: `/construction/rfis/v3/projects/${p}/search:rfis`, body: { limit: 1, offset: 0 } }),
    ),
    cell(get(`/construction/forms/v1/projects/${p}/forms`)),
    cell(get(`/construction/reviews/v1/projects/${p}/reviews`)),
    cell(get(`/construction/submittals/v2/projects/${p}/items`)),
  ]);
  return { Issues, RFIs, Forms, Reviews, Submittals };
}
