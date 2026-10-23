import type { BaseRecord } from "@/lib/generic/types";

export interface ReviewRecord extends BaseRecord {
  sequenceId: string;
  name: string;
  status: string;
  workflow: string;
  createdBy?: string;
  createdAt: string;
  dueDate?: string;
  finishedAt?: string;
  approvedAt?: string;
  // Who the review is waiting on (current step), comma-separated names.
  nextActionBy?: string;
}

export interface ReviewContext {
  projectId: string;
  projectName: string;
  workflows: Record<string, string>;
  people: Map<string, string>;
}

type Party = { autodeskId?: string; id?: string; name?: string } | string | null | undefined;

function str(v: unknown): string | undefined {
  return typeof v === "string" && v ? v : undefined;
}

function personName(p: Party, people: Map<string, string>): string | undefined {
  if (!p) return undefined;
  if (typeof p === "string") return people.get(p) ?? `Unknown user (${p.slice(0, 6)})`;
  const id = p.autodeskId ?? p.id;
  return p.name ?? (id ? (people.get(id) ?? `Unknown user (${id.slice(0, 6)})`) : undefined);
}

// nextActionBy has varied in shape; collect any named parties inside it.
function namesIn(v: unknown, people: Map<string, string>, out: Set<string>, depth = 0): void {
  if (!v || depth > 4) return;
  if (Array.isArray(v)) {
    for (const x of v) namesIn(x, people, out, depth + 1);
    return;
  }
  if (typeof v !== "object") return;
  const o = v as Record<string, unknown>;
  if (typeof o.name === "string" && o.name) {
    out.add(o.name);
    return;
  }
  if (typeof o.autodeskId === "string") {
    const n = personName(o as Party, people);
    if (n) out.add(n);
    return;
  }
  for (const x of Object.values(o)) namesIn(x, people, out, depth + 1);
}

export function normaliseReview(raw: unknown, ctx: ReviewContext): ReviewRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = str(r.id);
  if (!id) return null;
  const next = new Set<string>();
  namesIn(r.nextActionBy, ctx.people, next);
  const workflowId = str(r.workflowId) ?? "";
  const createdBy = personName(r.createdBy as Party, ctx.people);
  return {
    key: `${ctx.projectId}:${id}`,
    id,
    projectId: ctx.projectId,
    projectName: ctx.projectName,
    sequenceId: r.sequenceId === undefined ? "" : String(r.sequenceId),
    name: str(r.name) ?? "",
    status: str(r.status) ?? "unknown",
    workflow: ctx.workflows[workflowId] ?? "Unknown workflow",
    ...(createdBy ? { createdBy } : {}),
    createdAt: str(r.createdAt) ?? "",
    ...(str(r.currentStepDueDate) ? { dueDate: r.currentStepDueDate as string } : {}),
    ...(str(r.finishedAt) ? { finishedAt: r.finishedAt as string } : {}),
    ...(str(r.approvedAt) ? { approvedAt: r.approvedAt as string } : {}),
    ...(next.size ? { nextActionBy: [...next].join(", ") } : {}),
  };
}

const DONE = new Set(["closed", "void", "failed", "cancelled", "completed"]);

export function isReviewOpen(r: ReviewRecord): boolean {
  return !DONE.has(r.status.toLowerCase()) && !r.finishedAt;
}

export function isReviewOverdue(r: ReviewRecord, now: Date): boolean {
  return isReviewOpen(r) && !!r.dueDate && r.dueDate.slice(0, 10) < now.toISOString().slice(0, 10);
}

export function reviewStatusLabel(s: string): string {
  const w = s.replace(/_/g, " ").toLowerCase();
  return w.charAt(0).toUpperCase() + w.slice(1);
}
