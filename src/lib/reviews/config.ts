import { reviewUrl } from "@/lib/aps/links";
import { getReviewWorkflowNames, scrapeRawReviews } from "@/lib/aps/reviews";
import { getProjectDirectory } from "@/lib/aps/users";
import { countBy, gapFill, monthlyCounts } from "@/lib/dashboard/aggregate";
import { aliaser } from "@/lib/generic/aggregate";
import type { GenericConfig } from "@/lib/generic/types";
import type { ProjectLoader } from "@/lib/generic/use-generic-data";
import { isReviewOpen, isReviewOverdue, normaliseReview, reviewStatusLabel, type ReviewRecord } from "./normalise";

const DAY = 86_400_000;
const day = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-GB") : "");

export const loadReviews: ProjectLoader<ReviewRecord> = async (client, project) => {
  const raw = await scrapeRawReviews(client, project.id);
  const [workflows, dir] = await Promise.all([
    getReviewWorkflowNames(client, project.id),
    getProjectDirectory(client, project.id).catch(() => ({ people: new Map<string, string>() })),
  ]);
  const ctx = { projectId: project.id, projectName: project.name, workflows, people: dir.people };
  return raw.flatMap((r) => {
    const n = normaliseReview(r, ctx);
    return n ? [n] : [];
  });
};

function avgDays(items: ReviewRecord[]): string {
  const done = items.filter((r) => r.finishedAt && r.createdAt);
  if (!done.length) return "-";
  const total = done.reduce((s, r) => s + (Date.parse(r.finishedAt as string) - Date.parse(r.createdAt)) / DAY, 0);
  return (total / done.length).toFixed(1);
}

export const reviewsConfig: GenericConfig<ReviewRecord> = {
  kind: "reviews",
  title: "Reviews dashboard",
  noun: "reviews",
  filters: [
    { id: "status", label: "Status", valueOf: (r) => r.status, format: reviewStatusLabel },
    { id: "workflow", label: "Workflow", valueOf: (r) => r.workflow },
    { id: "waiting", label: "Waiting on", valueOf: (r) => r.nextActionBy ?? "Not recorded", multi: true },
    { id: "startedBy", label: "Started by", valueOf: (r) => r.createdBy ?? "Unknown" },
  ],
  dateFilter: { label: "Started", get: (r) => r.createdAt },
  searchText: (r) => `${r.sequenceId} ${r.name} ${r.workflow} ${r.createdBy ?? ""}`,
  isOpen: isReviewOpen,
  kpis: (items, now) => {
    const overdue = items.filter((r) => isReviewOverdue(r, now)).length;
    return [
      { label: "Reviews", value: String(items.length) },
      { label: "Open", value: String(items.filter(isReviewOpen).length) },
      { label: "Overdue step", value: String(overdue), alert: overdue > 0 },
      { label: "Finished", value: String(items.filter((r) => r.finishedAt).length) },
      { label: "With approval date", value: String(items.filter((r) => r.approvedAt).length) },
      { label: "Avg days to finish", value: avgDays(items) },
    ];
  },
  trend: {
    title: "Reviews started vs finished per month",
    series: [
      { key: "started", label: "Started", colour: "var(--series-1)", pdfColour: "#2a78d6" },
      { key: "finished", label: "Finished", colour: "var(--series-2)", pdfColour: "#eb6834" },
    ],
    build: (items) => {
      const started = monthlyCounts(items, (r) => r.createdAt);
      const finished = new Map(monthlyCounts(items, (r) => r.finishedAt).map((p) => [p.month, p.count]));
      const months = gapFill([...started.map((p) => p.month), ...finished.keys()]);
      const s = new Map(started.map((p) => [p.month, p.count]));
      return months.map((month) => ({ month, started: s.get(month) ?? 0, finished: finished.get(month) ?? 0 }));
    },
  },
  breakdowns: [
    { title: "Reviews by status", build: (items) => countBy(items, (r) => reviewStatusLabel(r.status)), filterId: "status" },
    { title: "Reviews by workflow", build: (items) => countBy(items, (r) => r.workflow), filterId: "workflow" },
    { title: "Open reviews waiting on", build: (items) => countBy(items.filter(isReviewOpen), (r) => r.nextActionBy ?? "Not recorded") },
    { title: "Reviews by project", build: (items) => countBy(items, (r) => r.projectName, 15) },
    { title: "Reviews started by", build: (items) => countBy(items, (r) => r.createdBy ?? "Unknown") },
  ],
  columns: [
    { label: "Name", value: (r) => r.name, width: 3 },
    { label: "Project", value: (r) => r.projectName, width: 2 },
    { label: "#", value: (r) => r.sequenceId, sortValue: (r) => r.sequenceId.padStart(6, "0"), width: 0.5 },
    { label: "Workflow", value: (r) => r.workflow, width: 1.6 },
    { label: "Status", value: (r) => reviewStatusLabel(r.status), width: 0.9 },
    { label: "Waiting on", value: (r) => (isReviewOpen(r) ? (r.nextActionBy ?? "") : ""), width: 1.5 },
    { label: "Started", value: (r) => day(r.createdAt), sortValue: (r) => r.createdAt, width: 1 },
    {
      label: "Step due",
      value: (r, now) => `${day(r.dueDate)}${isReviewOverdue(r, now) ? " (overdue)" : ""}`,
      sortValue: (r) => r.dueDate ?? "",
      alert: isReviewOverdue,
      width: 1.2,
    },
    { label: "Finished", value: (r) => day(r.finishedAt), sortValue: (r) => r.finishedAt ?? "", width: 1 },
  ],
  linkOf: (r) => reviewUrl(r.projectId, r.id),
  defaultSort: { column: 6, dir: -1 },
  redactionNote: "replace people's names with Person 1, Person 2.",
  redact: (ds) => {
    const alias = aliaser();
    return {
      projects: ds.projects,
      items: ds.items.map((r) => ({
        ...r,
        ...(r.createdBy ? { createdBy: alias(r.createdBy) } : {}),
        ...(r.nextActionBy ? { nextActionBy: r.nextActionBy.split(", ").map(alias).join(", ") } : {}),
      })),
    };
  },
};
