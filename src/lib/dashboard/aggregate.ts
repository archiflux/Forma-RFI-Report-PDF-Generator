// Pure aggregation helpers for the Issues dashboard. Everything takes an
// explicit `now` so tests (and published snapshots) are deterministic.

import type { DashboardFilters, IssueRecord } from "./types";

export type StatusBucket = "open" | "inProgress" | "completed" | "closed";

export const STATUS_BUCKETS: readonly StatusBucket[] = ["open", "inProgress", "completed", "closed"];

export const BUCKET_LABEL: Record<StatusBucket, string> = {
  open: "Open",
  inProgress: "In progress",
  completed: "Completed",
  closed: "Closed",
};

// ACC Issues workflow states. Unknown states count as in progress so they
// stay visible as outstanding work.
const BUCKET_OF: Record<string, StatusBucket> = {
  draft: "open",
  open: "open",
  pending: "inProgress",
  in_progress: "inProgress",
  in_review: "inProgress",
  not_approved: "inProgress",
  in_dispute: "inProgress",
  completed: "completed",
  closed: "closed",
};

export function statusBucket(status: string): StatusBucket {
  return BUCKET_OF[status] ?? "inProgress";
}

export function statusLabel(status: string): string {
  const s = status.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function isOutstanding(i: IssueRecord): boolean {
  const b = statusBucket(i.status);
  return b === "open" || b === "inProgress";
}

export function isOverdue(i: IssueRecord, now: Date): boolean {
  if (!i.dueDate || !isOutstanding(i)) return false;
  // Due dates are calendar days; an issue due today is not yet overdue.
  return i.dueDate.slice(0, 10) < now.toISOString().slice(0, 10);
}

const DAY_MS = 86_400_000;

function daysBetween(a: string, b: Date): number {
  return (b.getTime() - new Date(a).getTime()) / DAY_MS;
}

export function applyFilters(issues: IssueRecord[], f: DashboardFilters): IssueRecord[] {
  const q = f.search.trim().toLowerCase();
  return issues.filter((i) => {
    if (f.projectIds.length && !f.projectIds.includes(i.projectId)) return false;
    if (f.statuses.length && !f.statuses.includes(i.status)) return false;
    if (f.types.length && !f.types.includes(i.typeName)) return false;
    if (f.assignees.length && !f.assignees.includes(i.assignee?.name ?? "Unassigned")) return false;
    if (f.createdFrom && i.createdAt.slice(0, 10) < f.createdFrom) return false;
    if (f.createdTo && i.createdAt.slice(0, 10) > f.createdTo) return false;
    if (q) {
      const hay = `${i.displayId} ${i.title} ${i.location ?? ""} ${i.assignee?.name ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export interface Kpis {
  total: number;
  outstanding: number;
  overdue: number;
  closed: number;
  avgDaysToClose: number | null;
  withViewpoint: number;
}

export function kpis(issues: IssueRecord[], now: Date): Kpis {
  let outstanding = 0;
  let overdue = 0;
  let closed = 0;
  let withViewpoint = 0;
  let closeDays = 0;
  let closeCount = 0;
  for (const i of issues) {
    if (isOutstanding(i)) outstanding++;
    else closed++;
    if (isOverdue(i, now)) overdue++;
    if (i.hasViewpoint) withViewpoint++;
    if (i.closedAt && i.createdAt) {
      closeDays += daysBetween(i.createdAt, new Date(i.closedAt));
      closeCount++;
    }
  }
  return {
    total: issues.length,
    outstanding,
    overdue,
    closed,
    avgDaysToClose: closeCount ? closeDays / closeCount : null,
    withViewpoint,
  };
}

export interface Count {
  label: string;
  count: number;
}

// Counts sorted descending; anything past `limit` folds into "Other".
export function countBy<T>(
  items: T[],
  keyOf: (i: T) => string,
  limit = 10,
): Count[] {
  const m = new Map<string, number>();
  for (const i of items) {
    const k = keyOf(i) || "Not set";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  const sorted = [...m.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  if (sorted.length <= limit) return sorted;
  const head = sorted.slice(0, limit - 1);
  const rest = sorted.slice(limit - 1).reduce((s, c) => s + c.count, 0);
  return [...head, { label: "Other", count: rest }];
}

export type BucketCounts = Record<StatusBucket, number>;

export interface ProjectStatusRow {
  projectId: string;
  projectName: string;
  counts: BucketCounts;
  total: number;
  overdue: number;
}

export function statusByProject(issues: IssueRecord[], now: Date): ProjectStatusRow[] {
  const m = new Map<string, ProjectStatusRow>();
  for (const i of issues) {
    let row = m.get(i.projectId);
    if (!row) {
      row = {
        projectId: i.projectId,
        projectName: i.projectName,
        counts: { open: 0, inProgress: 0, completed: 0, closed: 0 },
        total: 0,
        overdue: 0,
      };
      m.set(i.projectId, row);
    }
    row.counts[statusBucket(i.status)]++;
    row.total++;
    if (isOverdue(i, now)) row.overdue++;
  }
  return [...m.values()].sort((a, b) => b.total - a.total);
}

// Count of items per calendar month (YYYY-MM), gap-filled between the
// first and last month seen. Items with no date are skipped.
export function monthlyCounts<T>(items: T[], dateOf: (i: T) => string | undefined): Array<{ month: string; count: number }> {
  const m = new Map<string, number>();
  for (const i of items) {
    const d = dateOf(i);
    if (d) m.set(d.slice(0, 7), (m.get(d.slice(0, 7)) ?? 0) + 1);
  }
  return gapFill([...m.keys()]).map((month) => ({ month, count: m.get(month) ?? 0 }));
}

export function gapFill(keys: string[]): string[] {
  const months = [...new Set(keys)].sort();
  if (!months.length) return [];
  const out: string[] = [];
  let [y, m] = (months[0] as string).split("-").map(Number) as [number, number];
  const last = months[months.length - 1] as string;
  for (;;) {
    const k = `${y}-${String(m).padStart(2, "0")}`;
    out.push(k);
    if (k >= last) break;
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

export interface MonthPoint {
  month: string; // YYYY-MM
  created: number;
  closed: number;
}

// Created vs closed per calendar month, gap-filled so the x-axis is even.
export function monthlyTrend(issues: IssueRecord[]): MonthPoint[] {
  const created = new Map<string, number>();
  const closed = new Map<string, number>();
  for (const i of issues) {
    if (i.createdAt) {
      const k = i.createdAt.slice(0, 7);
      created.set(k, (created.get(k) ?? 0) + 1);
    }
    if (i.closedAt) {
      const k = i.closedAt.slice(0, 7);
      closed.set(k, (closed.get(k) ?? 0) + 1);
    }
  }
  return gapFill([...created.keys(), ...closed.keys()]).map((month) => ({
    month,
    created: created.get(month) ?? 0,
    closed: closed.get(month) ?? 0,
  }));
}

export const AGE_BUCKETS = ["0-7 days", "8-30 days", "31-90 days", "91-180 days", "Over 180 days"] as const;

export function ageing(issues: IssueRecord[], now: Date): Count[] {
  const counts = AGE_BUCKETS.map((label) => ({ label, count: 0 }));
  for (const i of issues) {
    if (!isOutstanding(i) || !i.createdAt) continue;
    const d = daysBetween(i.createdAt, now);
    const idx = d <= 7 ? 0 : d <= 30 ? 1 : d <= 90 ? 2 : d <= 180 ? 3 : 4;
    (counts[idx] as Count).count++;
  }
  return counts;
}
