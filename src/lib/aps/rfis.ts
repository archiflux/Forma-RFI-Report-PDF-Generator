import type { ApsClient } from "./client";
import { normaliseProjectIdForRfi } from "./projects";
import type {
  CustomAttributeDef,
  Rfi,
  RfiScrapeProgress,
  RfiSearchRequest,
  RfiSearchResponse,
} from "./types";

const DEFAULT_PAGE_SIZE = 200;
const MAX_TOTAL = 5000;

export async function listCustomAttributes(
  client: ApsClient,
  projectId: string,
): Promise<CustomAttributeDef[]> {
  const p = normaliseProjectIdForRfi(projectId);
  const res = await client.request<{ results?: CustomAttributeDef[] }>({
    path: `/construction/rfis/v3/projects/${encodeURIComponent(p)}/attributes`,
  });
  return res.results ?? [];
}

export async function searchRfisPage(
  client: ApsClient,
  projectId: string,
  request: RfiSearchRequest = {},
): Promise<RfiSearchResponse> {
  const p = normaliseProjectIdForRfi(projectId);
  return client.request<RfiSearchResponse>({
    method: "POST",
    path: `/construction/rfis/v3/projects/${encodeURIComponent(p)}/search:rfis`,
    body: {
      limit: request.limit ?? DEFAULT_PAGE_SIZE,
      offset: request.offset ?? 0,
      ...(request.filter ? { filter: request.filter } : {}),
      ...(request.sort ? { sort: request.sort } : {}),
    },
  });
}

// Walk every page of search:rfis until exhausted or MAX_TOTAL hit.
// onProgress lets the UI render a progress bar without waiting for the full set.
export async function scrapeAllRfis(
  client: ApsClient,
  projectId: string,
  filter?: RfiSearchRequest["filter"],
  sort?: RfiSearchRequest["sort"],
  onProgress?: (p: RfiScrapeProgress) => void,
  signal?: AbortSignal,
): Promise<Rfi[]> {
  const limit = DEFAULT_PAGE_SIZE;
  let offset = 0;
  const out: Rfi[] = [];

  for (;;) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const page = await searchRfisPage(client, projectId, { limit, offset, filter, sort });
    out.push(...page.results);
    onProgress?.({ loaded: out.length, total: page.pagination.totalResults });
    if (page.results.length < limit) break;
    offset += limit;
    if (out.length >= MAX_TOTAL) break;
  }
  return out;
}
