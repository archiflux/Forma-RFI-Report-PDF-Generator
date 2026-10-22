// Dashboard data model. A DashboardDataset is a self-contained, serialisable
// view of BCF-style Issues across one or more projects. The live dashboard
// builds one from APS; a published snapshot is the same object loaded from
// a file, so both render through the same components.

export type AssigneeKind = "user" | "company" | "role" | "unknown";

export interface IssueRecord {
  // `${projectId}:${id}` — issue ids are only unique within a project.
  key: string;
  id: string;
  projectId: string;
  projectName: string;
  displayId: string;
  title: string;
  description?: string;
  status: string;
  typeName: string;
  subtypeName: string;
  rootCause: string;
  location?: string;
  assignee?: { id: string; name: string; kind: AssigneeKind };
  createdBy?: string;
  createdAt: string;
  dueDate?: string;
  closedAt?: string;
  updatedAt?: string;
  published?: boolean;
  commentCount: number;
  attachmentCount: number;
  // True when the issue is pinned to a model/sheet (linkedDocuments with a
  // viewpoint) — the BCF "topic with viewpoint" case.
  hasViewpoint: boolean;
  // Custom attribute values keyed by attribute title, flattened to text.
  custom: Record<string, string>;
}

export interface DatasetProject {
  id: string;
  name: string;
  issueCount: number;
  // Issues API returned 404: the Issues tool isn't activated in this project
  // (Docs-only, template or archived projects). Not an error.
  issuesUnavailable?: boolean;
  // Members the signed-in user could read; 0 means names can't be resolved.
  memberCount?: number;
  error?: string;
}

export interface DashboardDataset {
  version: 1;
  generatedAt: string;
  hubId: string;
  title?: string;
  projects: DatasetProject[];
  issues: IssueRecord[];
}

export interface DashboardFilters {
  projectIds: string[];
  statuses: string[];
  types: string[];
  assignees: string[];
  search: string;
  createdFrom?: string;
  createdTo?: string;
}

export const EMPTY_FILTERS: DashboardFilters = {
  projectIds: [],
  statuses: [],
  types: [],
  assignees: [],
  search: "",
};
