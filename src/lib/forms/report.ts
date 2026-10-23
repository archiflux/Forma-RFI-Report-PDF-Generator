import { formUrl } from "@/lib/aps/links";
import { capRows, describeFilters, PDF_SERIES, type DashboardReport } from "@/lib/report/dashboard/model";
import { formBreakdowns, formKpis, type FormFilters } from "./aggregate";
import { formStatusLabel, isFormOverdue } from "./normalise";
import type { FormRecord } from "./types";

function day(iso?: string): string {
  return iso ? new Date(iso).toLocaleDateString("en-GB") : "";
}

export function buildFormsReport(input: {
  forms: FormRecord[];
  filters: FormFilters;
  projectNames: Record<string, string>;
  now: Date;
  includeRegister: boolean;
  title?: string;
}): DashboardReport {
  const { forms, filters: f, now } = input;
  const k = formKpis(forms, now);
  const b = formBreakdowns(forms, now);
  const projectCount = new Set(forms.map((x) => x.projectId)).size;
  const register = capRows([...forms].sort((a, c) => (c.formDate ?? "").localeCompare(a.formDate ?? "")));
  return {
    title: input.title ?? "Forms dashboard",
    subtitle: `${forms.length} forms across ${projectCount} project${projectCount === 1 ? "" : "s"}`,
    generatedAt: now.toISOString(),
    filters: describeFilters([
      ["Projects", f.projectIds.map((id) => input.projectNames[id] ?? id)],
      ["Template", f.templates],
      ["Status", f.statuses.map(formStatusLabel)],
      ["Search", f.search.trim() || undefined],
    ]),
    kpis: [
      { label: "Forms", value: String(k.total) },
      { label: "Open", value: String(k.open) },
      { label: "Overdue", value: String(k.overdue), alert: k.overdue > 0 },
      { label: "Due in 7 days", value: String(k.dueSoon) },
      { label: "Templates in use", value: String(k.templates) },
    ],
    sections: [
      { kind: "trend", title: "Forms per month", series: [{ key: "count", label: "Forms", colour: PDF_SERIES[0] }], data: b.trend.map((p) => ({ ...p })) },
      { kind: "bars", title: "Forms by template", data: b.byTemplate },
      { kind: "bars", title: "Forms by status", data: b.byStatus },
      { kind: "bars", title: "Overdue forms by template", data: b.overdueByTemplate },
      { kind: "bars", title: "Forms by project", data: b.byProject },
      { kind: "bars", title: "Forms by creator", data: b.byCreator },
      ...(input.includeRegister
        ? [
            {
              kind: "table" as const,
              title: `Form register (${forms.length})`,
              columns: ["Name", "Project", "#", "Template", "Status", "Created by", "Form date", "Due"],
              widths: [3, 2, 0.5, 1.6, 1, 1.4, 1, 1.3],
              rows: register.rows.map((x) => [
                x.name || "(untitled)",
                x.projectName,
                x.formNum,
                x.templateName,
                formStatusLabel(x.status),
                x.createdBy ?? "",
                day(x.formDate),
                `${day(x.dueDate)}${isFormOverdue(x, now) ? " (overdue)" : ""}`,
              ]),
              links: register.rows.map((x) => formUrl(x.projectId, x.id)),
              totalRows: register.totalRows,
            },
          ]
        : []),
    ],
  };
}
