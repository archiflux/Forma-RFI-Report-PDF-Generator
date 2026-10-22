// Extraction probe: hits a catalogue of read-only APS endpoints for one
// project and reports what came back (status, record count, field coverage).
// Used to decide which dashboard templates a tenant can actually support.
// Every call is a GET, so it stays inside the read-only contract.

import type { ApsClient } from "./client";
import { normaliseProjectIdForRfi } from "./projects";
import { ApsError } from "./types";

export interface ProbeTarget {
  id: string;
  group: string;
  label: string;
  // Builds the path from the bare project id (no "b." prefix) and hub id.
  path: (p: string, hubId: string, bp: string) => string;
  query?: Record<string, string>;
}

export const PROBE_TARGETS: ProbeTarget[] = [
  { id: "issues", group: "Issues (BCF)", label: "Issues list", path: (p) => `/construction/issues/v1/projects/${p}/issues`, query: { limit: "50" } },
  { id: "issue-types", group: "Issues (BCF)", label: "Issue types + subtypes", path: (p) => `/construction/issues/v1/projects/${p}/issue-types`, query: { include: "subtypes" } },
  { id: "issue-root-causes", group: "Issues (BCF)", label: "Root cause categories", path: (p) => `/construction/issues/v1/projects/${p}/issue-root-cause-categories`, query: { include: "rootcauses" } },
  { id: "issue-attrs", group: "Issues (BCF)", label: "Custom attribute definitions", path: (p) => `/construction/issues/v1/projects/${p}/issue-attribute-definitions` },
  { id: "issue-attr-mappings", group: "Issues (BCF)", label: "Custom attribute mappings", path: (p) => `/construction/issues/v1/projects/${p}/issue-attribute-mappings` },
  { id: "issue-me", group: "Issues (BCF)", label: "My issue permissions", path: (p) => `/construction/issues/v1/projects/${p}/users/me` },
  { id: "bcf-topics", group: "Issues (BCF)", label: "BCF 2.1 topics (BIM 360 legacy)", path: (p) => `/bcf/2.1/projects/${p}/topics` },
  { id: "rfis-types", group: "RFIs", label: "RFI types", path: (p) => `/construction/rfis/v3/projects/${p}/rfi-types` },
  { id: "locations", group: "Project setup", label: "Locations tree", path: (p) => `/construction/locations/v2/projects/${p}/trees/default/nodes`, query: { limit: "50" } },
  { id: "users", group: "Project setup", label: "Project members", path: (p) => `/construction/admin/v1/projects/${p}/users`, query: { limit: "50" } },
  { id: "companies", group: "Project setup", label: "Project companies", path: (p) => `/construction/admin/v1/projects/${p}/companies`, query: { limit: "50" } },
  { id: "forms", group: "Forms", label: "Forms", path: (p) => `/construction/forms/v1/projects/${p}/forms`, query: { limit: "50" } },
  { id: "form-templates", group: "Forms", label: "Form templates", path: (p) => `/construction/forms/v1/projects/${p}/form-templates`, query: { limit: "50" } },
  { id: "assets", group: "Assets", label: "Assets", path: (p) => `/construction/assets/v2/projects/${p}/assets`, query: { limit: "50" } },
  { id: "submittals", group: "Submittals", label: "Submittal items", path: (p) => `/construction/submittals/v2/projects/${p}/items`, query: { limit: "50" } },
  { id: "reviews", group: "Reviews", label: "Document reviews", path: (p) => `/construction/reviews/v1/projects/${p}/reviews`, query: { limit: "50" } },
  { id: "photos", group: "Photos", label: "Photos", path: (p) => `/construction/photos/v1/projects/${p}/photos`, query: { limit: "50" } },
  { id: "meetings", group: "Meetings", label: "Meeting minutes", path: (p) => `/construction/meetings/v1/projects/${p}/meetings`, query: { limit: "50" } },
  { id: "cost-budgets", group: "Cost", label: "Cost budgets", path: (p) => `/cost/v1/containers/${p}/budgets`, query: { limit: "50" } },
  { id: "mc-modelsets", group: "Model coordination", label: "Model sets", path: (p) => `/bim360/modelset/v3/containers/${p}/modelsets` },
  { id: "dm-topfolders", group: "Docs", label: "Top folders", path: (_p, hubId, bp) => `/project/v1/hubs/${hubId}/projects/${bp}/topFolders` },
];

export interface ProbeResult {
  id: string;
  group: string;
  label: string;
  path: string;
  status: number | "error";
  ms: number;
  count: number | null;
  total: number | null;
  // Field name -> share of sampled records where it is non-empty (0..1).
  coverage: Array<{ field: string; share: number }>;
  sample?: unknown;
  message?: string;
}

function recordsOf(body: unknown): unknown[] | null {
  if (Array.isArray(body)) return body;
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    for (const k of ["results", "data", "items", "topics"]) {
      if (Array.isArray(b[k])) return b[k] as unknown[];
    }
  }
  return null;
}

function totalOf(body: unknown): number | null {
  if (!body || typeof body !== "object") return null;
  const p = (body as { pagination?: { totalResults?: unknown } }).pagination;
  return typeof p?.totalResults === "number" ? p.totalResults : null;
}

function isEmpty(v: unknown): boolean {
  return (
    v === null ||
    v === undefined ||
    v === "" ||
    (Array.isArray(v) && v.length === 0) ||
    (typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0)
  );
}

export function fieldCoverage(records: unknown[]): Array<{ field: string; share: number }> {
  const objs = records.filter((r): r is Record<string, unknown> => !!r && typeof r === "object");
  if (!objs.length) return [];
  const filled = new Map<string, number>();
  for (const o of objs) {
    for (const [k, v] of Object.entries(o)) {
      filled.set(k, (filled.get(k) ?? 0) + (isEmpty(v) ? 0 : 1));
    }
  }
  return [...filled.entries()]
    .map(([field, n]) => ({ field, share: n / objs.length }))
    .sort((a, b) => b.share - a.share || a.field.localeCompare(b.field));
}

export async function runProbe(
  client: ApsClient,
  target: ProbeTarget,
  hubId: string,
  projectId: string,
): Promise<ProbeResult> {
  const p = encodeURIComponent(normaliseProjectIdForRfi(projectId));
  const path = target.path(p, encodeURIComponent(hubId), encodeURIComponent(projectId));
  const started = performance.now();
  const baseResult = { id: target.id, group: target.group, label: target.label, path };
  try {
    const body = await client.request<unknown>({ path, query: target.query });
    const records = recordsOf(body);
    return {
      ...baseResult,
      status: 200,
      ms: Math.round(performance.now() - started),
      count: records?.length ?? null,
      total: totalOf(body),
      coverage: records ? fieldCoverage(records) : [],
      sample: records ? records[0] : body,
    };
  } catch (e) {
    return {
      ...baseResult,
      status: e instanceof ApsError ? e.status : "error",
      ms: Math.round(performance.now() - started),
      count: null,
      total: null,
      coverage: [],
      message: e instanceof Error ? e.message : String(e),
    };
  }
}
