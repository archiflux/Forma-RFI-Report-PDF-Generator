// Every column the Issues register can show. The first eight are the
// defaults; the rest (and each custom field) can be switched on.

import { issueUrl } from "@/lib/aps/links";
import { customKeys, type RegisterColumn } from "@/lib/layout/register";
import { isOverdue, statusLabel } from "./aggregate";
import type { IssueRecord } from "./types";

const day = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-GB") : "");
const num = (s: string) => {
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : s;
};

export const ISSUE_DEFAULT_SORT = { col: "created", dir: -1 } as const;

export function issueColumns(issues: IssueRecord[], now: Date): Array<RegisterColumn<IssueRecord>> {
  const cols: Array<RegisterColumn<IssueRecord>> = [
    { id: "project", label: "Project", value: (i) => i.projectName, width: 2, default: true },
    { id: "number", label: "#", value: (i) => i.displayId, sortValue: (i) => num(i.displayId), width: 0.6, default: true },
    {
      id: "title",
      label: "Title",
      value: (i) => i.title,
      href: (i) => (i.projectId.startsWith("demo-") ? undefined : issueUrl(i.projectId, i.id)),
      badge: (i) => (i.hasViewpoint ? "pinned" : undefined),
      width: 3.2,
      default: true,
    },
    { id: "type", label: "Type", value: (i) => i.typeName, width: 1.3, default: true },
    { id: "subtype", label: "Subtype", value: (i) => i.subtypeName, width: 1.3 },
    { id: "status", label: "Status", value: (i) => statusLabel(i.status), width: 1, default: true },
    { id: "assignee", label: "Assigned to", value: (i) => i.assignee?.name ?? "Unassigned", width: 1.4, default: true },
    {
      id: "due",
      label: "Due",
      value: (i) => `${day(i.dueDate)}${isOverdue(i, now) ? " (overdue)" : ""}`,
      sortValue: (i) => i.dueDate ?? "",
      alert: (i) => isOverdue(i, now),
      width: 1.3,
      default: true,
    },
    { id: "created", label: "Created", value: (i) => day(i.createdAt), sortValue: (i) => i.createdAt, width: 1, default: true },
    { id: "createdBy", label: "Created by", value: (i) => i.createdBy ?? "", width: 1.4 },
    { id: "closed", label: "Closed", value: (i) => day(i.closedAt), sortValue: (i) => i.closedAt ?? "", width: 1 },
    { id: "updated", label: "Last updated", value: (i) => day(i.updatedAt), sortValue: (i) => i.updatedAt ?? "", width: 1 },
    { id: "rootCause", label: "Root cause", value: (i) => i.rootCause, width: 1.3 },
    { id: "location", label: "Location", value: (i) => i.location ?? "", width: 1.5 },
    { id: "comments", label: "Comments", value: (i) => String(i.commentCount), sortValue: (i) => i.commentCount, width: 0.8 },
    { id: "attachments", label: "Attachments", value: (i) => String(i.attachmentCount), sortValue: (i) => i.attachmentCount, width: 0.8 },
    { id: "pinned", label: "Pinned to model", value: (i) => (i.hasViewpoint ? "Yes" : "No"), width: 0.8 },
    { id: "description", label: "Description", value: (i) => i.description ?? "", width: 3 },
  ];
  for (const k of customKeys(issues.map((i) => i.custom))) {
    cols.push({ id: `custom:${k}`, label: k, value: (i) => i.custom[k] ?? "", width: 1.2 });
  }
  return cols;
}
