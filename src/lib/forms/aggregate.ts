import { countBy, monthlyCounts } from "@/lib/dashboard/aggregate";
import { formStatusLabel, isFormOpen, isFormOverdue } from "./normalise";
import type { FormRecord } from "./types";

export interface FormFilters {
  projectIds: string[];
  templates: string[];
  statuses: string[];
  search: string;
}

export const EMPTY_FORM_FILTERS: FormFilters = { projectIds: [], templates: [], statuses: [], search: "" };

export function applyFormFilters(forms: FormRecord[], f: FormFilters): FormRecord[] {
  const q = f.search.trim().toLowerCase();
  return forms.filter(
    (x) =>
      (!f.projectIds.length || f.projectIds.includes(x.projectId)) &&
      (!f.templates.length || f.templates.includes(x.templateName)) &&
      (!f.statuses.length || f.statuses.includes(x.status)) &&
      (!q || `${x.formNum} ${x.name} ${x.templateName}`.toLowerCase().includes(q)),
  );
}

export function formKpis(forms: FormRecord[], now: Date) {
  const today = now.toISOString().slice(0, 10);
  const in7 = new Date(now.getTime() + 7 * 86_400_000).toISOString().slice(0, 10);
  return {
    total: forms.length,
    open: forms.filter(isFormOpen).length,
    overdue: forms.filter((x) => isFormOverdue(x, now)).length,
    dueSoon: forms.filter((x) => {
      const d = x.dueDate?.slice(0, 10);
      return isFormOpen(x) && !!d && d >= today && d <= in7;
    }).length,
    templates: new Set(forms.map((x) => x.templateName)).size,
  };
}

export function formBreakdowns(forms: FormRecord[], now: Date) {
  return {
    byTemplate: countBy(forms, (x) => x.templateName),
    byStatus: countBy(forms, (x) => formStatusLabel(x.status), 12),
    byCreator: countBy(forms, (x) => x.createdBy ?? "Unknown"),
    byProject: countBy(forms, (x) => x.projectName, 15),
    overdueByTemplate: countBy(forms.filter((x) => isFormOverdue(x, now)), (x) => x.templateName),
    trend: monthlyCounts(forms, (x) => x.formDate ?? x.createdAt),
  };
}
