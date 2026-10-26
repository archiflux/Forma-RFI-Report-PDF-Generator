import { submittalUrl } from "@/lib/aps/links";
import { getSubmittalLookups, scrapeRawSubmittals, type SubmittalLookups } from "@/lib/aps/submittals";
import { getProjectDirectory } from "@/lib/aps/users";
import { countBy, gapFill, monthlyCounts } from "@/lib/dashboard/aggregate";
import { aliaser } from "@/lib/generic/aggregate";
import { asText } from "@/lib/generic/text";
import { averageDays } from "@/lib/charts/series";
import type { BaseRecord, GenericConfig } from "@/lib/generic/types";
import type { ProjectLoader } from "@/lib/generic/use-generic-data";

export interface SubmittalRecord extends BaseRecord {
  number: string;
  title: string;
  status: string;
  state: string;
  type: string;
  spec?: string;
  revision?: string;
  response?: string;
  ballInCourt?: string;
  manager?: string;
  createdAt: string;
  dueDate?: string;
  closedAt?: string;
}

// Documented defaults, used when /metadata isn't readable.
const STATUS_DEFAULT: Record<string, string> = { "1": "Required", "2": "Open", "3": "Closed", "4": "Void", "5": "Empty", "6": "Draft" };
const STATE_LABEL: Record<string, string> = {
  draft: "Draft",
  "sbc-1": "Waiting for submission",
  "mgr-1": "Manager review",
  rev: "In review",
  "mgr-2": "Manager final review",
  "sbc-2": "Returned to submitter",
  void: "Void",
};

const day = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-GB") : "");

function ids(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((x) => {
    if (typeof x === "string") return [x];
    if (x && typeof x === "object") {
      const o = x as Record<string, unknown>;
      const id = asText(o.autodeskId ?? o.id ?? o.userId);
      return id ? [id] : [];
    }
    return [];
  });
}

export function normaliseSubmittal(
  raw: unknown,
  ctx: { projectId: string; projectName: string; lookups: SubmittalLookups; names: ReadonlyMap<string, string> },
): SubmittalRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = asText(r.id);
  if (!id) return null;
  const name = (x: string) => ctx.names.get(x) ?? `Unknown (${x.slice(0, 6)})`;
  const statusId = asText(r.statusId) ?? "";
  const stateId = asText(r.stateId) ?? "";
  const bic = [...ids(r.ballInCourtUsers), ...ids(r.ballInCourtRoles), ...ids(r.ballInCourtCompanies)].map(name);
  const manager = asText(r.manager) ?? asText(r.managerId);
  const spec = asText(r.specIdentifier) ?? asText((r.spec as Record<string, unknown> | undefined)?.identifier) ?? asText(r.specId);
  const response = asText(r.responseId) ? (ctx.lookups.responses[asText(r.responseId) as string] ?? asText(r.responseId)) : asText(r.response);
  const due = asText(r.requiredApprovalDate) ?? asText(r.submitterDueDate) ?? asText(r.dueDate);
  const closed = asText(r.closedDate) ?? asText(r.closedAt) ?? asText(r.respondedAt);
  return {
    key: `${ctx.projectId}:${id}`,
    id,
    projectId: ctx.projectId,
    projectName: ctx.projectName,
    number: asText(r.customIdentifierHumanReadable) ?? asText(r.customIdentifier) ?? asText(r.identifier) ?? "",
    title: asText(r.title) ?? "",
    status: ctx.lookups.statuses[statusId] ?? STATUS_DEFAULT[statusId] ?? (statusId || "Unknown"),
    state: STATE_LABEL[stateId] ?? (stateId || "Unknown"),
    type: ctx.lookups.types[asText(r.typeId) ?? ""] ?? asText(r.type) ?? "Not set",
    ...(spec ? { spec } : {}),
    ...(asText(r.revision) ? { revision: asText(r.revision) as string } : {}),
    ...(response ? { response } : {}),
    ...(bic.length ? { ballInCourt: bic.join(", ") } : {}),
    ...(manager ? { manager: ctx.names.get(manager) ?? manager } : {}),
    createdAt: asText(r.createdAt) ?? "",
    ...(due ? { dueDate: due } : {}),
    ...(closed ? { closedAt: closed } : {}),
  };
}

export function isSubmittalOpen(s: SubmittalRecord): boolean {
  return !["closed", "void"].includes(s.status.toLowerCase()) && s.state !== "Void";
}

export function isSubmittalOverdue(s: SubmittalRecord, now: Date): boolean {
  return isSubmittalOpen(s) && !!s.dueDate && s.dueDate.slice(0, 10) < now.toISOString().slice(0, 10);
}

export const loadSubmittals: ProjectLoader<SubmittalRecord> = async (client, project) => {
  const raw = await scrapeRawSubmittals(client, project.id);
  if (!raw.length) return [];
  const empty = new Map<string, string>();
  const [lookups, dir] = await Promise.all([
    getSubmittalLookups(client, project.id),
    getProjectDirectory(client, project.id).catch(() => ({ people: empty, companies: empty, roles: empty })),
  ]);
  const names = new Map([...dir.roles, ...dir.companies, ...dir.people]);
  const ctx = { projectId: project.id, projectName: project.name, lookups, names };
  return raw.flatMap((r) => {
    const n = normaliseSubmittal(r, ctx);
    return n ? [n] : [];
  });
};

export const submittalsConfig: GenericConfig<SubmittalRecord> = {
  kind: "submittals",
  title: "Submittals dashboard",
  noun: "submittal items",
  filters: [
    { id: "status", label: "Status", valueOf: (s) => s.status },
    { id: "state", label: "Stage", valueOf: (s) => s.state },
    { id: "type", label: "Type", valueOf: (s) => s.type },
    { id: "bic", label: "Ball in court", valueOf: (s) => s.ballInCourt ?? "Not recorded", multi: true },
    { id: "spec", label: "Spec", valueOf: (s) => s.spec ?? "Not set" },
  ],
  dateFilter: { label: "Created", get: (s) => s.createdAt },
  searchText: (s) => `${s.number} ${s.title} ${s.spec ?? ""} ${s.ballInCourt ?? ""}`,
  isOpen: isSubmittalOpen,
  kpis: (items, now) => {
    const overdue = items.filter((s) => isSubmittalOverdue(s, now)).length;
    return [
      { label: "Items", value: String(items.length) },
      { label: "Open", value: String(items.filter(isSubmittalOpen).length) },
      { label: "Overdue", value: String(overdue), alert: overdue > 0 },
      { label: "Closed", value: String(items.filter((s) => !isSubmittalOpen(s)).length) },
      { label: "Spec sections", value: String(new Set(items.map((s) => s.spec).filter(Boolean)).size) },
      { label: "Types", value: String(new Set(items.map((s) => s.type)).size) },
    ];
  },
  trend: {
    title: "Items created vs closed per month",
    series: [
      { key: "created", label: "Created", colour: "var(--series-1)", pdfColour: "#2a78d6" },
      { key: "closed", label: "Closed", colour: "var(--series-2)", pdfColour: "#eb6834" },
    ],
    build: (items) => {
      const c = new Map(monthlyCounts(items, (s) => s.createdAt).map((p) => [p.month, p.count]));
      const d = new Map(monthlyCounts(items, (s) => s.closedAt).map((p) => [p.month, p.count]));
      return gapFill([...c.keys(), ...d.keys()]).map((month) => ({ month, created: c.get(month) ?? 0, closed: d.get(month) ?? 0 }));
    },
  },
  donut: { title: "Items by status", build: (items) => countBy(items, (s) => s.status, 6) },
  treemap: { title: "Items by type", build: (items) => countBy(items, (s) => s.type, 16), filterId: "type" },
  gauge: { title: "Average days to close", unit: "days, created to closed", value: (items) => averageDays(items, (s) => s.createdAt, (s) => s.closedAt) },
  statusOf: (s) => s.status,
  overdue: {
    title: "Top 10 most overdue submittal items",
    dueOf: (s) => s.dueDate,
    ownerLabel: "Ball in court",
    ownerOf: (s) => s.ballInCourt,
    numberOf: (s) => s.number,
    titleOf: (s) => s.title,
  },
  breakdowns: [
    { title: "Items by workflow stage", build: (items) => countBy(items, (s) => s.state), filterId: "state" },
    { title: "Open items: ball in court", build: (items) => countBy(items.filter(isSubmittalOpen), (s) => s.ballInCourt ?? "Not recorded") },
    { title: "Items by response", build: (items) => countBy(items, (s) => s.response ?? "No response yet") },
  ],
  columns: [
    { label: "Title", value: (s) => s.title, width: 3 },
    { label: "Project", value: (s) => s.projectName, width: 2 },
    { label: "#", value: (s) => s.number, width: 0.7 },
    { label: "Spec", value: (s) => s.spec ?? "", width: 0.9 },
    { label: "Type", value: (s) => s.type, width: 1.1 },
    { label: "Status", value: (s) => s.status, width: 0.8 },
    { label: "Stage", value: (s) => s.state, width: 1.2 },
    { label: "Ball in court", value: (s) => (isSubmittalOpen(s) ? (s.ballInCourt ?? "") : ""), width: 1.4 },
    {
      label: "Required by",
      value: (s, now) => `${day(s.dueDate)}${isSubmittalOverdue(s, now) ? " (overdue)" : ""}`,
      sortValue: (s) => s.dueDate ?? "",
      alert: isSubmittalOverdue,
      width: 1.2,
    },
  ],
  linkOf: (s) => submittalUrl(s.projectId, s.id),
  defaultSort: { column: 8, dir: 1 },
  redactionNote: "replace people's names with Person 1, Person 2.",
  redact: (ds) => {
    const alias = aliaser();
    return {
      projects: ds.projects,
      items: ds.items.map((s) => {
        const { manager, ballInCourt, ...rest } = s;
        return {
          ...rest,
          ...(manager ? { manager: alias(manager) } : {}),
          ...(ballInCourt ? { ballInCourt: ballInCourt.split(", ").map(alias).join(", ") } : {}),
        };
      }),
    };
  },
};
