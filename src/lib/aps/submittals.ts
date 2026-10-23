// Submittals API (all GET). Untested against live data: none of the
// probed projects had submittal items, so shapes follow Autodesk's docs
// and every lookup is best-effort.
//   /construction/submittals/v2/projects/:p/items
//   /construction/submittals/v2/projects/:p/item-types
//   /construction/submittals/v2/projects/:p/metadata

import type { ApsClient } from "./client";
import { normaliseProjectIdForRfi } from "./projects";

const PAGE = 50;
const MAX_TOTAL = 10000;

function base(projectId: string): string {
  return `/construction/submittals/v2/projects/${encodeURIComponent(normaliseProjectIdForRfi(projectId))}`;
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

export function scrapeRawSubmittals(client: ApsClient, projectId: string): Promise<unknown[]> {
  return scrape(client, `${base(projectId)}/items`);
}

type Titled = { id?: string | number; value?: string; name?: string; title?: string };

function labelMap(list: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!Array.isArray(list)) return out;
  for (const x of list as Titled[]) {
    const label = x?.value ?? x?.name ?? x?.title;
    if (x?.id !== undefined && label) out[String(x.id)] = label;
  }
  return out;
}

export interface SubmittalLookups {
  types: Record<string, string>;
  statuses: Record<string, string>;
  responses: Record<string, string>;
}

export async function getSubmittalLookups(client: ApsClient, projectId: string): Promise<SubmittalLookups> {
  const [types, meta] = await Promise.all([
    scrape(client, `${base(projectId)}/item-types`).catch(() => []),
    client.request<Record<string, unknown>>({ path: `${base(projectId)}/metadata` }).catch(() => ({}) as Record<string, unknown>),
  ]);
  // Metadata groups lists by key; pick the status and response lists by name.
  const pick = (re: RegExp) => Object.entries(meta).find(([k, v]) => re.test(k) && Array.isArray(v))?.[1];
  return {
    types: labelMap(types),
    statuses: labelMap(pick(/status/i)),
    responses: labelMap(pick(/response/i)),
  };
}
