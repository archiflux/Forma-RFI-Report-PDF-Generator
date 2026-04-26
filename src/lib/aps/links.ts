// Build user-facing Forma deep links so reports can point readers back to
// the original record. ACC/Forma URLs follow the pattern:
//
//   https://acc.autodesk.com/build/rfis/projects/<projectId>/<rfiId>
//   https://acc.autodesk.com/build/issues/projects/<projectId>/<issueId>
//
// IDs in URLs are the Construction id (no "b." prefix). Inputs may carry the
// prefix, so strip it to be safe.
const FORMA_BASE = "https://acc.autodesk.com/build";

function strip(projectId: string): string {
  return projectId.startsWith("b.") ? projectId.slice(2) : projectId;
}

export function rfiUrl(projectId: string, rfiId: string): string {
  return `${FORMA_BASE}/rfis/projects/${strip(projectId)}/${rfiId}`;
}

export function issueUrl(projectId: string, issueId: string): string {
  return `${FORMA_BASE}/issues/projects/${strip(projectId)}/${issueId}`;
}
