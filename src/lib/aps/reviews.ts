// Document Reviews API (all GET).
//   /construction/reviews/v1/projects/:p/reviews
//   /construction/reviews/v1/projects/:p/workflows

import type { ApsClient } from "./client";
import { normaliseProjectIdForRfi } from "./projects";

const PAGE = 50;
const MAX_TOTAL = 10000;

function base(projectId: string): string {
  return `/construction/reviews/v1/projects/${encodeURIComponent(normaliseProjectIdForRfi(projectId))}`;
}

async function scrape(client: ApsClient, path: string): Promise<unknown[]> {
  const out: unknown[] = [];
  let offset = 0;
  for (;;) {
    const res = await client.request<{ results?: unknown[] }>({ path, query: { limit: PAGE, offset } });
    const page = res.results ?? [];
    out.push(...page);
    if (page.length < PAGE || out.length >= MAX_TOTAL) break;
    offset += PAGE;
  }
  return out;
}

export function scrapeRawReviews(client: ApsClient, projectId: string): Promise<unknown[]> {
  return scrape(client, `${base(projectId)}/reviews`);
}

export async function getReviewWorkflowNames(client: ApsClient, projectId: string): Promise<Record<string, string>> {
  try {
    const raw = (await scrape(client, `${base(projectId)}/workflows`)) as Array<{ id?: string; name?: string }>;
    return Object.fromEntries(raw.filter((w) => w?.id && w.name).map((w) => [w.id as string, w.name as string]));
  } catch {
    return {};
  }
}
