import { rfiUrl } from "@/lib/aps/links";
import { listCustomAttributes, mergeCustomAttributes, scrapeAllRfis } from "@/lib/aps/rfis";
import { getProjectDirectory } from "@/lib/aps/users";
import type { CustomAttributeDef, Rfi, RfiParty } from "@/lib/aps/types";
import { countBy, gapFill, monthlyCounts } from "@/lib/dashboard/aggregate";
import { aliaser } from "@/lib/generic/aggregate";
import type { BaseRecord, GenericConfig } from "@/lib/generic/types";
import type { ProjectLoader } from "@/lib/generic/use-generic-data";
import { asText } from "@/lib/generic/text";

export interface RfiRecord extends BaseRecord {
  number: string;
  title: string;
  status: string;
  priority?: string;
  discipline?: string;
  category?: string;
  ballInCourt?: string;
  manager?: string;
  createdAt: string;
  dueDate?: string;
  respondedAt?: string;
  closedAt?: string;
  // Custom attribute title -> value text (multi-choice joined with " | ").
  custom: Record<string, string>;
}

// Custom attributes by title. Attributes whose title couldn't be resolved
// (only an id is known) are left out rather than shown as ids.
export function rfiCustom(r: Rfi, defs: CustomAttributeDef[]): Record<string, string> {
  const out: Record<string, string> = {};
  const byId = new Map(defs.map((d) => [d.id, d]));
  for (const [id, values] of Object.entries(r.customAttributes ?? {})) {
    const def = byId.get(id);
    const name = def?.name ?? r.customAttributesMeta?.[id]?.name;
    if (!name || name === id) continue;
    const labels = new Map((def?.values ?? []).map((v) => [v.id, v.label]));
    const text = (Array.isArray(values) ? values : [values])
      .map((v) => labels.get(String(v)) ?? asText(v))
      .filter((v): v is string => Boolean(v))
      .join(" | ");
    if (text) out[name] = text;
  }
  return out;
}

const DAY = 86_400_000;
const day = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-GB") : "");
const DONE = new Set(["closed", "void", "rejected", "cancelled"]);

// RFI parties arrive id-only (name === id). Resolve against people, then
// companies and roles; label anything left so raw ids never show.
export function partyName(p: RfiParty, lookup: ReadonlyMap<string, string>): string {
  if (p.name && p.name !== p.id) return p.name;
  return lookup.get(p.id) ?? `Unknown (${p.id.slice(0, 6)})`;
}

export function toRfiRecord(
  r: Rfi,
  projectId: string,
  projectName: string,
  lookup: ReadonlyMap<string, string> = new Map(),
  defs: CustomAttributeDef[] = [],
): RfiRecord {
  const bic = (r.ballInCourt.length ? r.ballInCourt : r.assignees).map((p) => partyName(p, lookup)).join(", ");
  const priority = asText(r.priority);
  const discipline = asText(r.discipline);
  const category = asText(r.category);
  return {
    key: `${projectId}:${r.id}`,
    id: r.id,
    projectId,
    projectName,
    number: asText(r.number) ?? "",
    title: asText(r.title) ?? "",
    status: asText(r.status) ?? "unknown",
    ...(priority ? { priority } : {}),
    ...(discipline ? { discipline } : {}),
    ...(category ? { category } : {}),
    ...(bic ? { ballInCourt: bic } : {}),
    ...(r.manager ? { manager: partyName(r.manager, lookup) } : {}),
    createdAt: asText(r.createdAt) ?? "",
    ...(asText(r.dueDate) ? { dueDate: asText(r.dueDate) as string } : {}),
    ...(asText(r.respondedAt) ? { respondedAt: asText(r.respondedAt) as string } : {}),
    ...(asText(r.closedAt) ? { closedAt: asText(r.closedAt) as string } : {}),
    custom: rfiCustom(r, defs),
  };
}

export const loadRfis: ProjectLoader<RfiRecord> = async (client, project) => {
  const empty = new Map<string, string>();
  const [rfis, dir, fetchedDefs] = await Promise.all([
    scrapeAllRfis(client, project.id),
    getProjectDirectory(client, project.id).catch(() => ({ people: empty, companies: empty, roles: empty })),
    listCustomAttributes(client, project.id).catch(() => []),
  ]);
  const lookup = new Map([...dir.roles, ...dir.companies, ...dir.people]);
  const defs = mergeCustomAttributes(fetchedDefs, rfis);
  return rfis.map((r) => toRfiRecord(r, project.id, project.name, lookup, defs));
};

export function isRfiOpen(r: RfiRecord): boolean {
  return !DONE.has(r.status.toLowerCase()) && !r.closedAt;
}

export function isRfiOverdue(r: RfiRecord, now: Date): boolean {
  return isRfiOpen(r) && !r.respondedAt && !!r.dueDate && r.dueDate.slice(0, 10) < now.toISOString().slice(0, 10);
}

export function rfiStatusLabel(s: string): string {
  const w = s.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return w.charAt(0).toUpperCase() + w.slice(1);
}

function avg(items: RfiRecord[], end: (r: RfiRecord) => string | undefined): string {
  const xs = items.flatMap((r) => {
    const e = end(r);
    return e && r.createdAt ? [(Date.parse(e) - Date.parse(r.createdAt)) / DAY] : [];
  });
  return xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1) : "-";
}

export const rfisConfig: GenericConfig<RfiRecord> = {
  kind: "rfis",
  title: "RFI dashboard",
  noun: "RFIs",
  filters: [
    { id: "status", label: "Status", valueOf: (r) => r.status, format: rfiStatusLabel },
    { id: "discipline", label: "Discipline", valueOf: (r) => r.discipline ?? "Not set" },
    { id: "priority", label: "Priority", valueOf: (r) => r.priority ?? "Not set" },
  ],
  searchText: (r) => `${r.number} ${r.title} ${r.ballInCourt ?? ""} ${r.discipline ?? ""}`,
  customOf: (r) => r.custom,
  kpis: (items, now) => {
    const overdue = items.filter((r) => isRfiOverdue(r, now)).length;
    return [
      { label: "RFIs", value: String(items.length) },
      { label: "Open", value: String(items.filter(isRfiOpen).length) },
      { label: "Overdue response", value: String(overdue), alert: overdue > 0 },
      { label: "Closed", value: String(items.filter((r) => !isRfiOpen(r)).length) },
      { label: "Avg days to respond", value: avg(items, (r) => r.respondedAt) },
      { label: "Avg days to close", value: avg(items, (r) => r.closedAt) },
    ];
  },
  trend: {
    title: "RFIs raised vs closed per month",
    series: [
      { key: "raised", label: "Raised", colour: "var(--series-1)", pdfColour: "#2a78d6" },
      { key: "closed", label: "Closed", colour: "var(--series-2)", pdfColour: "#eb6834" },
    ],
    build: (items) => {
      const raised = new Map(monthlyCounts(items, (r) => r.createdAt).map((p) => [p.month, p.count]));
      const closed = new Map(monthlyCounts(items, (r) => r.closedAt).map((p) => [p.month, p.count]));
      return gapFill([...raised.keys(), ...closed.keys()]).map((month) => ({
        month,
        raised: raised.get(month) ?? 0,
        closed: closed.get(month) ?? 0,
      }));
    },
  },
  breakdowns: [
    { title: "RFIs by status", build: (items) => countBy(items, (r) => rfiStatusLabel(r.status)), filterId: "status" },
    { title: "Open RFIs: ball in court", build: (items) => countBy(items.filter(isRfiOpen), (r) => r.ballInCourt ?? "Not recorded") },
    { title: "RFIs by discipline", build: (items) => countBy(items, (r) => r.discipline ?? "Not set"), filterId: "discipline" },
    { title: "RFIs by priority", build: (items) => countBy(items, (r) => r.priority ?? "Not set"), filterId: "priority" },
    { title: "RFIs by category", build: (items) => countBy(items, (r) => r.category ?? "Not set") },
    { title: "RFIs by project", build: (items) => countBy(items, (r) => r.projectName, 15) },
  ],
  columns: [
    { label: "Title", value: (r) => r.title, width: 3 },
    { label: "Project", value: (r) => r.projectName, width: 2 },
    { label: "#", value: (r) => r.number, width: 0.7 },
    { label: "Status", value: (r) => rfiStatusLabel(r.status), width: 0.9 },
    { label: "Ball in court", value: (r) => (isRfiOpen(r) ? (r.ballInCourt ?? "") : ""), width: 1.5 },
    { label: "Discipline", value: (r) => r.discipline ?? "", width: 1.1 },
    { label: "Raised", value: (r) => day(r.createdAt), sortValue: (r) => r.createdAt, width: 0.9 },
    {
      label: "Due",
      value: (r, now) => `${day(r.dueDate)}${isRfiOverdue(r, now) ? " (overdue)" : ""}`,
      sortValue: (r) => r.dueDate ?? "",
      alert: isRfiOverdue,
      width: 1.2,
    },
    { label: "Closed", value: (r) => day(r.closedAt), sortValue: (r) => r.closedAt ?? "", width: 0.9 },
  ],
  linkOf: (r) => rfiUrl(r.projectId, r.id),
  defaultSort: { column: 6, dir: -1 },
  redactionNote: "replace people's names with Person 1, Person 2.",
  redact: (ds) => {
    const alias = aliaser();
    return {
      projects: ds.projects,
      items: ds.items.map((r) => {
        const { manager, ballInCourt, ...rest } = r;
        return {
          ...rest,
          // Custom fields can hold names or commercial detail.
          custom: {},
          ...(manager ? { manager: alias(manager) } : {}),
          ...(ballInCourt ? { ballInCourt: ballInCourt.split(", ").map(alias).join(", ") } : {}),
        };
      }),
    };
  },
};
