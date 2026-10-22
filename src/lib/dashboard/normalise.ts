import type { IssueLookups } from "@/lib/aps/issues-meta";
import type { AssigneeKind, IssueRecord } from "./types";

export interface NormaliseContext {
  projectId: string;
  projectName: string;
  lookups: IssueLookups;
  users: Record<string, string>;
  // Custom attribute titles keyed by definition id.
  attrNames: Record<string, string>;
}

interface RawIssue {
  id?: string;
  displayId?: number | string;
  title?: string;
  description?: string | null;
  status?: string;
  issueTypeId?: string;
  issueSubtypeId?: string;
  rootCauseId?: string | null;
  locationDetails?: string | null;
  assignedTo?: string | null;
  assignedToType?: string | null;
  createdBy?: string;
  createdAt?: string;
  dueDate?: string | null;
  closedAt?: string | null;
  updatedAt?: string;
  published?: boolean;
  commentCount?: number;
  attachmentCount?: number;
  linkedDocuments?: unknown[] | null;
  customAttributes?: Array<{ attributeDefinitionId?: string; value?: unknown; title?: string }> | null;
}

const ASSIGNEE_KINDS: readonly AssigneeKind[] = ["user", "company", "role"];

function str(v: unknown): string | undefined {
  return typeof v === "string" && v ? v : undefined;
}

function valueText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.map(valueText).filter(Boolean).join(" | ");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function normaliseIssue(raw: unknown, ctx: NormaliseContext): IssueRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as RawIssue;
  if (!r.id) return null;

  const kindRaw = (r.assignedToType ?? "").toLowerCase();
  const kind: AssigneeKind = (ASSIGNEE_KINDS as readonly string[]).includes(kindRaw)
    ? (kindRaw as AssigneeKind)
    : "unknown";
  const assigneeId = str(r.assignedTo);

  const custom: Record<string, string> = {};
  for (const c of r.customAttributes ?? []) {
    const id = c?.attributeDefinitionId;
    if (!id) continue;
    const text = valueText(c.value);
    if (!text) continue;
    custom[ctx.attrNames[id] ?? c.title ?? id] = text;
  }

  const typeName = (r.issueTypeId && ctx.lookups.types[r.issueTypeId]) || "Unspecified";
  const subtypeName = (r.issueSubtypeId && ctx.lookups.subtypes[r.issueSubtypeId]) || typeName;
  const rootCause = (r.rootCauseId && ctx.lookups.rootCauses[r.rootCauseId]) || "Not set";

  return {
    key: `${ctx.projectId}:${r.id}`,
    id: r.id,
    projectId: ctx.projectId,
    projectName: ctx.projectName,
    displayId: r.displayId === undefined ? "" : String(r.displayId),
    title: r.title ?? "",
    ...(str(r.description) ? { description: r.description as string } : {}),
    status: r.status ?? "unknown",
    typeName,
    subtypeName,
    rootCause,
    ...(str(r.locationDetails) ? { location: r.locationDetails as string } : {}),
    ...(assigneeId
      ? {
          assignee: {
            id: assigneeId,
            name: ctx.users[assigneeId] ?? (kind === "user" ? assigneeId : `${kind} ${assigneeId.slice(0, 8)}`),
            kind,
          },
        }
      : {}),
    ...(str(r.createdBy) ? { createdBy: ctx.users[r.createdBy as string] ?? r.createdBy } : {}),
    createdAt: r.createdAt ?? "",
    ...(str(r.dueDate) ? { dueDate: r.dueDate as string } : {}),
    ...(str(r.closedAt) ? { closedAt: r.closedAt as string } : {}),
    ...(str(r.updatedAt) ? { updatedAt: r.updatedAt } : {}),
    ...(typeof r.published === "boolean" ? { published: r.published } : {}),
    commentCount: typeof r.commentCount === "number" ? r.commentCount : 0,
    attachmentCount: typeof r.attachmentCount === "number" ? r.attachmentCount : 0,
    hasViewpoint: Array.isArray(r.linkedDocuments) && r.linkedDocuments.length > 0,
    custom,
  };
}
