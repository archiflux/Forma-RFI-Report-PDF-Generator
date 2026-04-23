export interface Hub {
  id: string;
  name: string;
  region?: string;
  extensionType?: string;
}

export interface Project {
  id: string;
  hubId: string;
  name: string;
}

export type CustomAttributeType =
  | "text"
  | "numeric"
  | "singleChoice"
  | "multiChoice";

export interface CustomAttributeChoice {
  id: string;
  label: string;
}

export interface CustomAttributeDef {
  id: string;
  name: string;
  dataType: CustomAttributeType;
  values?: CustomAttributeChoice[];
}

export interface RfiParty {
  id: string;
  name: string;
}

export interface Rfi {
  id: string;
  number: string;
  title: string;
  status: string;
  statusLabel?: string;
  createdAt: string;
  dueDate?: string;
  assignee?: RfiParty;
  manager?: RfiParty;
  question?: string;
  officialResponse?: string;
  customAttributes: Record<string, unknown>;
  attachmentCount: number;
}

export interface RfiSearchFilter {
  status?: string[];
  assignee?: string[];
  dueDate?: { gte?: string; lte?: string };
  createdAt?: { gte?: string; lte?: string };
  customAttributes?: Array<{ id: string; values: unknown[] }>;
}

export interface RfiSearchSort {
  field: string;
  order: "asc" | "desc";
}

export interface RfiSearchRequest {
  filter?: RfiSearchFilter;
  sort?: RfiSearchSort[];
  limit?: number;
  offset?: number;
}

export interface RfiSearchResponse {
  results: Rfi[];
  pagination: {
    limit: number;
    offset: number;
    totalResults?: number;
  };
}

export class ApsError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApsError";
  }
}
