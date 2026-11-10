import { formUrl } from "@/lib/aps/links";
import { describeFilters, PDF_SERIES, type DashboardReport } from "@/lib/report/dashboard/model";
import { EMPTY_LAYOUT, type DashLayout } from "@/lib/layout/layout";
import { registerSection } from "@/lib/layout/register";
import { formColumns, FORM_DEFAULT_SORT } from "./register";
import { formBreakdowns, formKpis, type FormFilters } from "./aggregate";
import { formStatusLabel, isFormOpen } from "./normalise";
import type { FormRecord } from "./types";
import { describeCustom } from "@/lib/custom/filter";
import { topOverdue } from "@/lib/charts/series";

function day(iso?: string): string {
  return iso ? new Date(iso).toLocaleDateString("en-GB") : "";
}

export function buildFormsReport(input: {
  forms: FormRecord[];
  filters: FormFilters;
  projectNames: Record<string, string>;
  now: Date;
  includeRegister: boolean;
  // Register row cap; the PDF uses the default, CSV passes Infinity.
  maxRegisterRows?: number;
  title?: string;
  // Register columns and sort chosen on screen.
  layout?: DashLayout;
}): DashboardReport {
  const { forms, filters: f, now } = input;
  const k = formKpis(forms, now);
  const b = formBreakdowns(forms, now);
  const late = topOverdue(forms, isFormOpen, (x) => x.dueDate, now);
  const projectCount = new Set(forms.map((x) => x.projectId)).size;
  return {
    title: input.title ?? "Forms dashboard",
    subtitle: `${forms.length} forms across ${projectCount} project${projectCount === 1 ? "" : "s"}`,
    generatedAt: now.toISOString(),
    filters: describeFilters([
      ["Projects", f.projectIds.map((id) => input.projectNames[id] ?? id)],
      ["Template", f.templates],
      ["Status", f.statuses.map(formStatusLabel)],
      ["Created by", f.creators ?? []],
      ["Form date from", f.from],
      ["Form date to", f.to],
      ["Search", f.search.trim() || undefined],
      ...describeCustom(f.custom ?? {}),
    ]),
    kpis: [
      { label: "Forms", value: String(k.total) },
      { label: "Open", value: String(k.open) },
      { label: "Overdue", value: String(k.overdue), alert: k.overdue > 0 },
      { label: "Due in 7 days", value: String(k.dueSoon) },
      { label: "Templates in use", value: String(k.templates) },
    ],
    sections: [
      { kind: "trend", id: "trend", title: "Forms per month", series: [{ key: "count", label: "Forms", colour: PDF_SERIES[0] }], data: b.trend.map((p) => ({ ...p })) },
      { kind: "bars", id: "template", title: "Forms by template", data: b.byTemplate },
      { kind: "bars", id: "status", title: "Forms by status", data: b.byStatus },
      { kind: "bars", id: "overdue-template", title: "Overdue forms by template", data: b.overdueByTemplate },
      { kind: "bars", id: "projects", title: "Forms by project", data: b.byProject },
      { kind: "bars", id: "creator", title: "Forms by creator", data: b.byCreator },
      {
        kind: "table" as const,
        id: "overdue",
        title: "Top 10 most overdue open forms",
        columns: ["Name", "Project", "#", "Created by", "Due", "Days overdue"],
        widths: [3, 2, 0.6, 1.6, 1, 0.9],
        rows: late.map((r) => [r.item.name || "(untitled)", r.item.projectName, r.item.formNum, r.item.createdBy ?? "", day(r.due), String(r.daysOverdue)]),
        links: late.map((r) => formUrl(r.item.projectId, r.item.templateId, r.item.id)),
      },
      ...(input.includeRegister
        ? [
            registerSection({
              title: `Form register (${forms.length})`,
              all: formColumns(forms, now),
              items: forms,
              layout: input.layout ?? EMPTY_LAYOUT,
              defaultSort: FORM_DEFAULT_SORT,
              ...(input.maxRegisterRows !== undefined ? { maxRows: input.maxRegisterRows } : {}),
            }),
          ]
        : []),
    ],
  };
}
