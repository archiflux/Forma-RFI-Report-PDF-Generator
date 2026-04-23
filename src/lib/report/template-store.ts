import {
  TEMPLATE_JSON_VERSION,
  type ReportTemplate,
  type TemplateExportEnvelope,
} from "./types";

// One key per project so switching projects doesn't surface unrelated templates.
// (Templates are still portable via Export/Import JSON — see exportTemplate.)
function storageKey(projectId: string): string {
  return `forma-rfi.templates.${projectId}`;
}

export interface TemplateStore {
  list(projectId: string): ReportTemplate[];
  save(projectId: string, template: ReportTemplate): void;
  remove(projectId: string, templateId: string): void;
}

function read(projectId: string): ReportTemplate[] {
  if (typeof localStorage === "undefined") return [];
  const raw = localStorage.getItem(storageKey(projectId));
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as ReportTemplate[];
    return [];
  } catch {
    return [];
  }
}

function write(projectId: string, templates: ReportTemplate[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(storageKey(projectId), JSON.stringify(templates));
}

export const templateStore: TemplateStore = {
  list: read,
  save(projectId, template) {
    const list = read(projectId);
    const idx = list.findIndex((t) => t.id === template.id);
    const updated: ReportTemplate = { ...template, updatedAt: new Date().toISOString() };
    if (idx >= 0) list[idx] = updated;
    else list.push(updated);
    write(projectId, list);
  },
  remove(projectId, templateId) {
    write(
      projectId,
      read(projectId).filter((t) => t.id !== templateId),
    );
  },
};

export function exportTemplate(template: ReportTemplate): string {
  const envelope: TemplateExportEnvelope = {
    $schema: "forma-rfi-report-template",
    version: TEMPLATE_JSON_VERSION,
    template,
  };
  return JSON.stringify(envelope, null, 2);
}

export class TemplateImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TemplateImportError";
  }
}

export function importTemplate(json: string): ReportTemplate {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new TemplateImportError("Not valid JSON.");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new TemplateImportError("Expected a JSON object.");
  }
  const env = parsed as Partial<TemplateExportEnvelope>;
  if (env.$schema !== "forma-rfi-report-template") {
    throw new TemplateImportError("Not a Forma RFI report template export.");
  }
  if (env.version !== TEMPLATE_JSON_VERSION) {
    throw new TemplateImportError(
      `Template schema version ${env.version} is not supported (expected ${TEMPLATE_JSON_VERSION}).`,
    );
  }
  if (!env.template || typeof env.template !== "object") {
    throw new TemplateImportError("Envelope is missing a template object.");
  }
  const t = env.template as ReportTemplate;
  // Minimal shape check — avoid trusting blindly.
  if (!t.id || !t.name || !Array.isArray(t.fields) || !t.filter || !Array.isArray(t.sort)) {
    throw new TemplateImportError("Template object is missing required fields.");
  }
  return t;
}

export function downloadTemplate(template: ReportTemplate): void {
  const blob = new Blob([exportTemplate(template)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${template.name.replace(/[^\w-]+/g, "-")}.rfi-template.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
