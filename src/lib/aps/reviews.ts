// Document Reviews API (all GET).
//   /construction/reviews/v1/projects/:p/reviews
//   /construction/reviews/v1/projects/:p/workflows

import type { ApsClient } from "./client";
import { scrapePaged } from "./paged";
import { normaliseProjectIdForRfi } from "./projects";

const PAGE = 50;
const MAX_TOTAL = 10000;

function base(projectId: string): string {
  return `/construction/reviews/v1/projects/${encodeURIComponent(normaliseProjectIdForRfi(projectId))}`;
}

function scrape(client: ApsClient, path: string): Promise<unknown[]> {
  return scrapePaged(client, path, { page: 200, fallbackPage: PAGE, max: MAX_TOTAL });
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
