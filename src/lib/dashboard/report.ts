import { issueUrl } from "@/lib/aps/links";
import { describeFilters, PDF_SERIES, type DashboardReport } from "@/lib/report/dashboard/model";
import { EMPTY_LAYOUT, type DashLayout } from "@/lib/layout/layout";
import { registerSection } from "@/lib/layout/register";
import { issueColumns, ISSUE_DEFAULT_SORT } from "./register";
import {
  ageing,
  BUCKET_LABEL,
  countBy,
  isOutstanding,
  kpis,
  monthlyTrend,
  statusByProject,
  statusLabel,
  STATUS_BUCKETS,
} from "./aggregate";
import type { DashboardFilters, IssueRecord } from "./types";
import { describeCustom } from "@/lib/custom/filter";
import { topOverdue } from "@/lib/charts/series";

function day(iso?: string): string {
  return iso ? new Date(iso).toLocaleDateString("en-GB") : "";
}

export function buildIssuesReport(input: {
  issues: IssueRecord[];
  filters: DashboardFilters;
  projectNames: Record<string, string>;
  projectCount: number;
  now: Date;
  includeRegister: boolean;
  // Register row cap; the PDF uses the default, CSV passes Infinity.
  maxRegisterRows?: number;
  title?: string;
  // Register columns and sort chosen on screen.
  layout?: DashLayout;
}): DashboardReport {
  const { issues, filters: f, now } = input;
  const k = kpis(issues, now);
  const late = topOverdue(issues, isOutstanding, (i) => i.dueDate, now);
  const projects = statusByProject(issues, now);
  return {
    title: input.title ?? "Issues dashboard",
    subtitle: `${issues.length} issues across ${input.projectCount} project${input.projectCount === 1 ? "" : "s"}`,
    generatedAt: now.toISOString(),
    filters: describeFilters([
      ["Projects", f.projectIds.map((id) => input.projectNames[id] ?? id)],
      ["Status", f.statuses.map(statusLabel)],
      ["Type", f.types],
      ["Assignee", f.assignees],
      ["Created from", f.createdFrom],
      ["Created to", f.createdTo],
      ["Search", f.search.trim() || undefined],
      ...describeCustom(f.custom ?? {}),
    ]),
    kpis: [
      { label: "Issues", value: String(k.total) },
      { label: "Outstanding", value: String(k.outstanding) },
      { label: "Overdue", value: String(k.overdue), alert: k.overdue > 0 },
      { label: "Completed or closed", value: String(k.closed) },
      { label: "Avg days to close", value: k.avgDaysToClose === null ? "-" : k.avgDaysToClose.toFixed(1) },
      { label: "Pinned to model", value: String(k.withViewpoint) },
    ],
    sections: [
      {
        kind: "trend",
        id: "trend",
        title: "Created vs closed per month",
        series: [
          { key: "created", label: "Created", colour: PDF_SERIES[0] },
          { key: "closed", label: "Closed", colour: PDF_SERIES[1] },
        ],
        data: monthlyTrend(issues).map((p) => ({ ...p })),
      },
      { kind: "bars", id: "ages", title: "Age of outstanding issues", data: ageing(issues, now) },
      { kind: "bars", id: "type", title: "Issues by type", data: countBy(issues, (i) => i.typeName) },
      { kind: "bars", id: "status", title: "Issues by status", data: countBy(issues, (i) => statusLabel(i.status), 12) },
      { kind: "bars", id: "workload", title: "Open workload by assignee", data: countBy(issues.filter(isOutstanding), (i) => i.assignee?.name ?? "Unassigned") },
      { kind: "bars", id: "cause", title: "Issues by root cause", data: countBy(issues, (i) => i.rootCause) },
      { kind: "bars", id: "location", title: "Issues by location", data: countBy(issues, (i) => i.location ?? "Not set") },
      {
        kind: "table",
        id: "overdue",
        title: "Top 10 most overdue open issues",
        columns: ["Title", "Project", "#", "Assigned to", "Due", "Days overdue"],
        widths: [3, 2, 0.6, 1.6, 1, 0.9],
        rows: late.map((r) => [r.item.title, r.item.projectName, r.item.displayId, r.item.assignee?.name ?? "Unassigned", day(r.due), String(r.daysOverdue)]),
        links: late.map((r) => (r.item.projectId.startsWith("demo-") ? undefined : issueUrl(r.item.projectId, r.item.id))),
      },
      {
        kind: "table",
        id: "status-by-project",
        title: "Status by project",
        columns: ["Project", ...STATUS_BUCKETS.map((b) => BUCKET_LABEL[b]), "Overdue", "Total"],
        rows: projects.map((p) => [
          p.projectName,
          ...STATUS_BUCKETS.map((b) => String(p.counts[b])),
          String(p.overdue),
          String(p.total),
        ]),
      },
      ...(input.includeRegister
        ? [
            registerSection({
              title: `Issue register (${issues.length})`,
              all: issueColumns(issues, now),
              items: issues,
              layout: input.layout ?? EMPTY_LAYOUT,
              defaultSort: ISSUE_DEFAULT_SORT,
              ...(input.maxRegisterRows !== undefined ? { maxRows: input.maxRegisterRows } : {}),
            }),
          ]
        : []),
    ],
  };
}
