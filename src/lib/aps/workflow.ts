import type { ApsClient } from "./client";
import { normaliseProjectIdForRfi } from "./projects";
import { ApsError } from "./types";

export interface WorkflowStatus {
  id: string;
  label: string;
}

interface RawWorkflowRow {
  id?: string;
  label?: string;
  name?: string;
  stepName?: string;
}

interface RawWorkflowResponse {
  states?: RawWorkflowRow[];
  statuses?: RawWorkflowRow[];
}

// The workflow endpoint's shape has drifted across beta/v3 iterations — the
// field we need ("human label for a status id") has lived under `states[].stepName`,
// `states[].label`, and `statuses[].label` at various times. Read defensively.
export async function getWorkflow(
  client: ApsClient,
  projectId: string,
): Promise<WorkflowStatus[]> {
  const p = normaliseProjectIdForRfi(projectId);
  try {
    const res = await client.request<RawWorkflowResponse>({
      path: `/construction/rfis/v3/projects/${encodeURIComponent(p)}/workflow`,
    });
    const rows = res.states ?? res.statuses ?? [];
    return rows
      .map((r) => ({
        id: r.id ?? "",
        label: r.label ?? r.stepName ?? r.name ?? r.id ?? "",
      }))
      .filter((s) => s.id);
  } catch (e) {
    // /workflow can 403 for non-admin users in some ACC configurations.
    // Fall back to no labels — the raw status id is still shown on the RFI.
    if (e instanceof ApsError && (e.status === 401 || e.status === 403)) {
      return [];
    }
    throw e;
  }
}

export function buildStatusLabelMap(workflow: WorkflowStatus[]): Map<string, string> {
  return new Map(workflow.map((s) => [s.id, s.label]));
}
