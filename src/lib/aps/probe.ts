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
  // Lists every project in the account, joined or not. Account admins only;
  // others get 403. Account id is the hub id without its "b." prefix.
  { id: "account-projects", group: "Account", label: "All projects in account (account admins only)", path: (_p, hubId) => `/construction/admin/v1/accounts/${hubId.replace(/^b\./, "")}/projects`, query: { limit: "200" } },
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
  // Extra plain-text findings (e.g. file names); safe to copy.
  notes?: string[];
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

// Data Connector (hub-wide extracts). Jobs are only readable by the user
// who created the request and needs Executive Overview or project admin
// rights. Walks: requests -> latest job -> file listing -> one signed URL.
// All GET; the signed URL itself is not downloaded here.
export async function runDataConnectorCheck(client: ApsClient, hubId: string): Promise<ProbeResult[]> {
  const account = encodeURIComponent(hubId.replace(/^b\./, ""));
  const base = `/data-connector/v1/accounts/${account}`;
  const group = "Data Connector (hub-wide)";
  const out: ProbeResult[] = [];
  const step = async (id: string, label: string, path: string, query?: Record<string, string>) => {
    const started = performance.now();
    try {
      const body = await client.request<unknown>({ path, query });
      const records = recordsOf(body);
      const r: ProbeResult = {
        id, group, label, path, status: 200, ms: Math.round(performance.now() - started),
        count: records?.length ?? null, total: totalOf(body), coverage: records ? fieldCoverage(records) : [],
        sample: records ? records[0] : body,
      };
      out.push(r);
      return { r, body, records };
    } catch (e) {
      out.push({
        id, group, label, path, status: e instanceof ApsError ? e.status : "error", ms: Math.round(performance.now() - started),
        count: null, total: null, coverage: [], message: e instanceof Error ? e.message : String(e),
      });
      return null;
    }
  };

  const reqs = await step("dc-requests", "My extraction requests", `${base}/requests`, { limit: "50", sort: "desc" });
  const requests = (reqs?.records ?? []) as Array<{ id?: string; description?: string; scheduleInterval?: string; serviceGroups?: string[]; createdAt?: string; isActive?: boolean }>;
  if (!reqs) return out;
  if (!requests.length) {
    (out[out.length - 1] as ProbeResult).notes = ["No extraction requests created by you. Create one in Forma > Insight > Data Connector, then run the probe again."];
    return out;
  }
  (out[out.length - 1] as ProbeResult).notes = requests.slice(0, 10).map(
    (r) => `${r.description || r.id}: ${r.scheduleInterval ?? "?"}${r.isActive === false ? " (inactive)" : ""}, services ${(r.serviceGroups ?? []).join(", ") || "all"}`,
  );
  const latestReq = [...requests].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))[0];
  if (!latestReq?.id) return out;

  const jobs = await step("dc-jobs", "Runs of the newest request", `${base}/requests/${encodeURIComponent(latestReq.id)}/jobs`, { limit: "20", sort: "desc" });
  const jobList = (jobs?.records ?? []) as Array<{ id?: string; status?: string; completionStatus?: string; completedAt?: string; startedAt?: string }>;
  if (jobs) {
    (out[out.length - 1] as ProbeResult).notes = jobList.slice(0, 5).map((j) => `${j.status ?? "?"}${j.completionStatus ? ` / ${j.completionStatus}` : ""}, finished ${j.completedAt ?? "not yet"}`);
  }
  const done = jobList.find((j) => (j.status ?? "").toLowerCase() === "complete" && (j.completionStatus ?? "success").toLowerCase() === "success")
    ?? jobList.find((j) => j.completedAt);
  if (!done?.id) return out;

  const listing = await step("dc-listing", "Files in the latest finished run", `${base}/jobs/${encodeURIComponent(done.id)}/data-listing`);
  const files = (listing ? (recordsOf(listing.body) ?? (Array.isArray(listing.body) ? listing.body : [])) : []) as Array<{ name?: string; size?: number }>;
  if (listing) {
    (out[out.length - 1] as ProbeResult).notes = files.map((f) => `${f.name}${typeof f.size === "number" ? ` (${Math.round(f.size / 1024)} KB)` : ""}`);
  }
  const small = [...files].filter((f) => f.name).sort((a, b) => (a.size ?? 0) - (b.size ?? 0))[0];
  if (!small?.name) return out;
  const url = await step("dc-signed-url", `Download link for ${small.name}`, `${base}/jobs/${encodeURIComponent(done.id)}/data/${encodeURIComponent(small.name)}`);
  if (url) {
    const signed = (url.body as { signedUrl?: string })?.signedUrl;
    const r = out[out.length - 1] as ProbeResult;
    r.sample = undefined; // don't keep a live signed URL around
    r.notes = [signed ? `Signed URL host: ${new URL(signed).host}` : "No signedUrl in response"];
  }
  return out;
}
