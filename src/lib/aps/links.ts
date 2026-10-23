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

// Patterns below are taken from the Forma web UI and haven't been confirmed
// against Autodesk documentation; if one lands on the wrong page, fix it
// here and every register picks it up.
export function formUrl(projectId: string, formId: string): string {
  return `${FORMA_BASE}/forms/projects/${strip(projectId)}/forms/${formId}`;
}

export function reviewUrl(projectId: string, reviewId: string): string {
  return `https://acc.autodesk.com/docs/reviews/projects/${strip(projectId)}/reviews/${reviewId}`;
}
