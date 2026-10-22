// Snapshot = a DashboardDataset frozen to a JSON file so it can be viewed
// without an Autodesk sign-in (the public /view page). Redaction happens
// here, before anything leaves the signed-in user's browser.

import { z } from "zod";
import type { DashboardDataset, IssueRecord } from "./types";

export interface SnapshotOptions {
  title?: string;
  includeDescriptions: boolean;
  // Replace individual people's names with "Person 1", "Person 2"...
  // Company and role assignees keep their names.
  anonymisePeople: boolean;
  includeCustomFields: boolean;
}

export const DEFAULT_SNAPSHOT_OPTIONS: SnapshotOptions = {
  includeDescriptions: false,
  anonymisePeople: true,
  includeCustomFields: false,
};

export function makeSnapshot(ds: DashboardDataset, o: SnapshotOptions, now = new Date()): DashboardDataset {
  const aliases = new Map<string, string>();
  const alias = (name: string) => {
    let a = aliases.get(name);
    if (!a) {
      a = `Person ${aliases.size + 1}`;
      aliases.set(name, a);
    }
    return a;
  };
  const issues = ds.issues.map((i): IssueRecord => {
    const out: IssueRecord = { ...i, custom: o.includeCustomFields ? i.custom : {} };
    if (!o.includeDescriptions) delete out.description;
    if (o.anonymisePeople) {
      if (out.assignee?.kind === "user") out.assignee = { ...out.assignee, id: "", name: alias(out.assignee.name) };
      if (out.createdBy) out.createdBy = alias(out.createdBy);
    }
    return out;
  });
  return {
    version: 1,
    generatedAt: now.toISOString(),
    hubId: "",
    ...(o.title ? { title: o.title } : {}),
    projects: ds.projects
      .filter((p) => !p.issuesUnavailable && !p.error)
      .map(({ id, name, issueCount }) => ({ id, name, issueCount })),
    issues,
  };
}

const IssueSchema = z.object({
  key: z.string(),
  id: z.string(),
  projectId: z.string(),
  projectName: z.string(),
  displayId: z.string(),
  title: z.string(),
  description: z.string().optional(),
  status: z.string(),
  typeName: z.string(),
  subtypeName: z.string(),
  rootCause: z.string(),
  location: z.string().optional(),
  assignee: z
    .object({ id: z.string(), name: z.string(), kind: z.enum(["user", "company", "role", "unknown"]) })
    .optional(),
  createdBy: z.string().optional(),
  createdAt: z.string(),
  dueDate: z.string().optional(),
  closedAt: z.string().optional(),
  updatedAt: z.string().optional(),
  published: z.boolean().optional(),
  commentCount: z.number(),
  attachmentCount: z.number(),
  hasViewpoint: z.boolean(),
  custom: z.record(z.string()),
});

const DatasetSchema = z.object({
  version: z.literal(1),
  generatedAt: z.string(),
  hubId: z.string(),
  title: z.string().optional(),
  projects: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      issueCount: z.number(),
      issuesUnavailable: z.boolean().optional(),
      memberCount: z.number().optional(),
      error: z.string().optional(),
    }),
  ),
  issues: z.array(IssueSchema),
});

export function parseSnapshot(json: unknown): DashboardDataset {
  return DatasetSchema.parse(json) as DashboardDataset;
}
