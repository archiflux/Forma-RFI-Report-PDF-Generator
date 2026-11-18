// Forms API (all GET). Page size is capped at 50 by APS.
//   /construction/forms/v1/projects/:p/forms
//   /construction/forms/v1/projects/:p/form-templates

import type { ApsClient } from "./client";
import { scrapePaged } from "./paged";
import { normaliseProjectIdForRfi } from "./projects";

const MAX_TOTAL = 10000;

function base(projectId: string): string {
  return `/construction/forms/v1/projects/${encodeURIComponent(normaliseProjectIdForRfi(projectId))}`;
}

function scrape(client: ApsClient, path: string): Promise<unknown[]> {
  return scrapePaged(client, path, { page: 50, max: MAX_TOTAL });
}

export function scrapeRawForms(client: ApsClient, projectId: string): Promise<unknown[]> {
  return scrape(client, `${base(projectId)}/forms`);
}

// Template id -> name. Best-effort; a failure leaves names to whatever the
// form payload carries.
export async function getFormTemplateNames(client: ApsClient, projectId: string): Promise<Record<string, string>> {
  try {
    const raw = await scrape(client, `${base(projectId)}/form-templates`);
    const out: Record<string, string> = {};
    for (const t of raw as Array<{ id?: string; name?: string }>) {
      if (t?.id && t.name) out[t.id] = t.name;
    }
    return out;
  } catch {
    return {};
  }
}
