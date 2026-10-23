import { issueUrl } from "@/lib/aps/links";
import { capRows, describeFilters, PDF_SERIES, type DashboardReport } from "@/lib/report/dashboard/model";
import {
  ageing,
  BUCKET_LABEL,
  countBy,
  isOutstanding,
  isOverdue,
  kpis,
  monthlyTrend,
  statusByProject,
  statusLabel,
  STATUS_BUCKETS,
} from "./aggregate";
import type { DashboardFilters, IssueRecord } from "./types";

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
}): DashboardReport {
  const { issues, filters: f, now } = input;
  const k = kpis(issues, now);
  const projects = statusByProject(issues, now);
  const register = capRows(
    [...issues].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    input.maxRegisterRows,
  );
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
        title: "Created vs closed per month",
        series: [
          { key: "created", label: "Created", colour: PDF_SERIES[0] },
          { key: "closed", label: "Closed", colour: PDF_SERIES[1] },
        ],
        data: monthlyTrend(issues).map((p) => ({ ...p })),
      },
      { kind: "bars", title: "Age of outstanding issues", data: ageing(issues, now) },
      { kind: "bars", title: "Issues by type", data: countBy(issues, (i) => i.typeName) },
      { kind: "bars", title: "Issues by status", data: countBy(issues, (i) => statusLabel(i.status), 12) },
      { kind: "bars", title: "Open workload by assignee", data: countBy(issues.filter(isOutstanding), (i) => i.assignee?.name ?? "Unassigned") },
      { kind: "bars", title: "Issues by root cause", data: countBy(issues, (i) => i.rootCause) },
      { kind: "bars", title: "Issues by location", data: countBy(issues, (i) => i.location ?? "Not set") },
      {
        kind: "table",
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
            {
              kind: "table" as const,
              title: `Issue register (${issues.length})`,
              columns: ["Title", "Project", "#", "Type", "Status", "Assigned to", "Due", "Created"],
              widths: [3.2, 2, 0.5, 1.3, 1, 1.4, 1.3, 1],
              rows: register.rows.map((i) => [
                i.title,
                i.projectName,
                i.displayId,
                i.subtypeName,
                statusLabel(i.status),
                i.assignee?.name ?? "Unassigned",
                `${day(i.dueDate)}${isOverdue(i, now) ? " (overdue)" : ""}`,
                day(i.createdAt),
              ]),
              links: register.rows.map((i) => (i.projectId.startsWith("demo-") ? undefined : issueUrl(i.projectId, i.id))),
              totalRows: register.totalRows,
              isRegister: true,
            },
          ]
        : []),
    ],
  };
}
