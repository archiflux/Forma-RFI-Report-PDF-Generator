// Forma deep links, so registers, PDFs and CSVs point readers back to the
// original record. Formats copied from the Forma web UI (October 2026):
//
//   Issue  /build/issues/projects/<project>/issues/<issueId>
//   RFI    /build/rfis/projects/<project>?preview=<rfiId>
//   Form   /build/forms/projects/<project>/field-reports/<templateId>/reports/<formId>
//   Review /docs/reviews/projects/<project>/<reviewId>
//
// IDs in URLs are the Construction id (no "b." prefix). Inputs may carry the
// prefix, so strip it. If Autodesk changes a format, fix it here and every
// register picks it up.
const FORMA = "https://acc.autodesk.com";

function strip(projectId: string): string {
  return encodeURIComponent(projectId.startsWith("b.") ? projectId.slice(2) : projectId);
}

const id = encodeURIComponent;

export function issueUrl(projectId: string, issueId: string): string {
  return `${FORMA}/build/issues/projects/${strip(projectId)}/issues/${id(issueId)}`;
}

export function rfiUrl(projectId: string, rfiId: string): string {
  return `${FORMA}/build/rfis/projects/${strip(projectId)}?preview=${id(rfiId)}`;
}

// Needs the form's template id: forms open under their template.
export function formUrl(projectId: string, templateId: string, formId: string): string {
  return `${FORMA}/build/forms/projects/${strip(projectId)}/field-reports/${id(templateId)}/reports/${id(formId)}`;
}

export function reviewUrl(projectId: string, reviewId: string): string {
  return `${FORMA}/docs/reviews/projects/${strip(projectId)}/${id(reviewId)}`;
}

// Not yet confirmed: no project with submittal items has been checked.
export function submittalUrl(projectId: string, itemId: string): string {
  return `${FORMA}/build/submittals/projects/${strip(projectId)}/items/${id(itemId)}`;
}
