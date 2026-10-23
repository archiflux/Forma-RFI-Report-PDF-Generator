import type { FormRecord } from "./types";

export interface FormsContext {
  projectId: string;
  projectName: string;
  templates: Record<string, string>;
  people: Map<string, string>;
}

interface RawForm {
  id?: string;
  formNum?: number | string;
  name?: string;
  status?: string;
  formDate?: string | null;
  dueDate?: string | null;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  formTemplate?: { id?: string; name?: string; templateType?: string } | string | null;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v ? v : undefined;
}

export function normaliseForm(raw: unknown, ctx: FormsContext): FormRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as RawForm;
  if (!r.id) return null;
  const tpl = typeof r.formTemplate === "string" ? { id: r.formTemplate } : (r.formTemplate ?? {});
  const templateId = tpl.id ?? "";
  const templateName = ctx.templates[templateId] ?? str((tpl as { name?: string }).name) ?? "Unknown template";
  const createdBy = str(r.createdBy);
  const templateType = str((tpl as { templateType?: string }).templateType);
  return {
    key: `${ctx.projectId}:${r.id}`,
    id: r.id,
    projectId: ctx.projectId,
    projectName: ctx.projectName,
    formNum: r.formNum === undefined ? "" : String(r.formNum),
    name: r.name ?? "",
    status: r.status ?? "unknown",
    templateId,
    templateName,
    ...(templateType ? { templateType } : {}),
    ...(str(r.formDate) ? { formDate: r.formDate as string } : {}),
    ...(str(r.dueDate) ? { dueDate: r.dueDate as string } : {}),
    ...(createdBy ? { createdBy: ctx.people.get(createdBy) ?? `Unknown user (${createdBy.slice(0, 6)})` } : {}),
    createdAt: r.createdAt ?? "",
    ...(str(r.updatedAt) ? { updatedAt: r.updatedAt } : {}),
  };
}

// Forms statuses seen across ACC tenants. Anything not listed counts as
// still open so it stays visible as outstanding.
const DONE = new Set(["submitted", "closed", "completed", "archived", "approved", "signed"]);

export function isFormOpen(f: FormRecord): boolean {
  return !DONE.has(f.status.toLowerCase());
}

export function isFormOverdue(f: FormRecord, now: Date): boolean {
  return Boolean(f.dueDate) && isFormOpen(f) && (f.dueDate as string).slice(0, 10) < now.toISOString().slice(0, 10);
}

// "inReview" / "in_review" -> "In review".
export function formStatusLabel(s: string): string {
  const words = s.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
