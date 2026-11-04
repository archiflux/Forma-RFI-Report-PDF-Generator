// Turns each dashboard's (already filtered) records into the cubes and
// "Organise by" options of the 3D dashboard.

import type { ProjectLocation } from "@/lib/aps/project-location";
import { isOutstanding, statusLabel, BUCKET_LABEL, statusBucket } from "@/lib/dashboard/aggregate";
import type { IssueRecord } from "@/lib/dashboard/types";
import { issueUrl, formUrl } from "@/lib/aps/links";
import { formStatusLabel, isFormOpen } from "@/lib/forms/normalise";
import type { FormRecord } from "@/lib/forms/types";
import { dimValues } from "@/lib/generic/aggregate";
import type { BaseRecord, GenericConfig } from "@/lib/generic/types";
import { dueStatus, MAX_THINGS, monthLabel, monthOf, type Dim3D, type Thing3D, type Universe3D } from "./universe";

type Locations = Record<string, ProjectLocation | null> | undefined;

function locs(l: Locations): Universe3D["locations"] {
  const out: Universe3D["locations"] = {};
  for (const [k, v] of Object.entries(l ?? {})) out[k] = v ? { lat: v.lat, lon: v.lon } : null;
  return out;
}

// The most-used custom fields become extra "Organise by" options.
function customDims(customs: Array<Record<string, string> | undefined>, limit = 6): Dim3D[] {
  const m = new Map<string, number>();
  for (const c of customs) for (const [k, v] of Object.entries(c ?? {})) if (v) m.set(k, (m.get(k) ?? 0) + 1);
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k]) => ({ id: `custom:${k}`, label: k }));
}

function withCustom(groups: Record<string, string>, custom: Record<string, string> | undefined, dims: Dim3D[]) {
  for (const d of dims) groups[d.id] = custom?.[d.label] || "Not set";
}

type Prop = { label: string; value: string };

function fmtDate(d: string | undefined): string {
  if (!d) return "";
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? d : t.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// Drops empty values so the panel only lists what is actually known.
function props(list: Array<[string, string | number | boolean | undefined | null]>, custom?: Record<string, string>): Prop[] {
  const out: Prop[] = [];
  const seen = new Set<string>();
  for (const [label, v] of list) {
    if (v === undefined || v === null || v === "" || seen.has(label)) continue;
    seen.add(label);
    out.push({ label, value: typeof v === "boolean" ? (v ? "Yes" : "No") : String(v) });
  }
  for (const [k, v] of Object.entries(custom ?? {})) if (v) out.push({ label: k, value: v });
  return out;
}

const MONTH_DIM: Dim3D = { id: "month", label: "Month created" };

export function issuesUniverse(issues: IssueRecord[], now: Date, locations: Locations, title = "Issues"): Universe3D {
  const list = issues.slice(0, MAX_THINGS);
  const custom = customDims(list.map((i) => i.custom));
  const dims: Dim3D[] = [
    { id: "status", label: "Status" },
    { id: "bucket", label: "Status group" },
    { id: "type", label: "Type" },
    { id: "assignee", label: "Assignee" },
    { id: "due", label: "Due date" },
    { id: "cause", label: "Root cause" },
    { id: "location", label: "Location" },
    { id: "project", label: "Project" },
    MONTH_DIM,
    ...custom,
  ];
  const things: Thing3D[] = list.map((i) => {
    const groups: Record<string, string> = {
      status: statusLabel(i.status),
      bucket: BUCKET_LABEL[statusBucket(i.status)],
      type: i.typeName || "Not set",
      assignee: i.assignee?.name ?? "Unassigned",
      due: dueStatus(i.dueDate, isOutstanding(i), now),
      cause: i.rootCause || "Not set",
      location: i.location ?? "Not set",
      project: i.projectName,
      month: monthOf(i.createdAt) ? monthLabel(monthOf(i.createdAt) as string) : "No date",
    };
    withCustom(groups, i.custom, custom);
    return {
      key: i.key,
      title: i.title || "(untitled)",
      subtitle: `#${i.displayId} · ${i.projectName}`,
      ...(i.projectId.startsWith("demo-") ? {} : { href: issueUrl(i.projectId, i.id) }),
      projectId: i.projectId,
      projectName: i.projectName,
      ...(monthOf(i.createdAt) ? { month: monthOf(i.createdAt) as string } : {}),
      groups,
      props: props(
        [
          ["Number", i.displayId ? `#${i.displayId}` : ""],
          ["Project", i.projectName],
          ["Status", groups.status],
          ["Due", groups.due],
          ["Type", i.typeName],
          ["Subtype", i.subtypeName],
          ["Root cause", i.rootCause],
          ["Location", i.location],
          ["Assigned to", i.assignee?.name ?? "Unassigned"],
          ["Created by", i.createdBy],
          ["Created", fmtDate(i.createdAt)],
          ["Due date", fmtDate(i.dueDate)],
          ["Closed", fmtDate(i.closedAt)],
          ["Last updated", fmtDate(i.updatedAt)],
          ["Comments", i.commentCount],
          ["Attachments", i.attachmentCount],
          ["Pinned to a model or sheet", i.hasViewpoint],
          ["Description", i.description],
        ],
        i.custom,
      ),
    };
  });
  return { title, noun: "issues", dims, things, locations: locs(locations) };
}

export function formsUniverse(forms: FormRecord[], now: Date, locations: Locations, title = "Forms"): Universe3D {
  const list = forms.slice(0, MAX_THINGS);
  const custom = customDims(list.map((f) => f.custom));
  const dims: Dim3D[] = [
    { id: "status", label: "Status" },
    { id: "template", label: "Template" },
    { id: "due", label: "Due date" },
    { id: "creator", label: "Created by" },
    { id: "project", label: "Project" },
    { id: "month", label: "Month (form date)" },
    ...custom,
  ];
  const things: Thing3D[] = list.map((f) => {
    const m = monthOf(f.formDate ?? f.createdAt);
    const groups: Record<string, string> = {
      status: formStatusLabel(f.status),
      template: f.templateName || "Not set",
      due: dueStatus(f.dueDate, isFormOpen(f), now),
      creator: f.createdBy || "Not set",
      project: f.projectName,
      month: m ? monthLabel(m) : "No date",
    };
    withCustom(groups, f.custom, custom);
    return {
      key: f.key,
      title: f.name || "(untitled)",
      subtitle: `${f.formNum ? `#${f.formNum} · ` : ""}${f.projectName}`,
      href: formUrl(f.projectId, f.templateId, f.id),
      projectId: f.projectId,
      projectName: f.projectName,
      ...(m ? { month: m } : {}),
      groups,
      props: props(
        [
          ["Number", f.formNum ? `#${f.formNum}` : ""],
          ["Project", f.projectName],
          ["Status", groups.status],
          ["Due", groups.due],
          ["Template", f.templateName],
          ["Template type", f.templateType],
          ["Form date", fmtDate(f.formDate)],
          ["Due date", fmtDate(f.dueDate)],
          ["Created by", f.createdBy],
          ["Created", fmtDate(f.createdAt)],
          ["Last updated", fmtDate(f.updatedAt)],
        ],
        f.custom,
      ),
    };
  });
  return { title, noun: "forms", dims, things, locations: locs(locations) };
}

export function genericUniverse<T extends BaseRecord>(cfg: GenericConfig<T>, items: T[], now: Date, locations: Locations, title?: string): Universe3D {
  const list = items.slice(0, MAX_THINGS);
  const custom = cfg.customOf ? customDims(list.map((t) => cfg.customOf?.(t))) : [];
  const dims: Dim3D[] = [
    ...(cfg.statusOf ? [{ id: "status", label: "Status" }] : []),
    ...cfg.filters.map((d) => ({ id: `f:${d.id}`, label: d.label })),
    ...(cfg.overdue ? [{ id: "due", label: "Due date" }] : []),
    { id: "project", label: "Project" },
    ...(cfg.dateFilter ? [{ id: "month", label: `Month (${cfg.dateFilter.label.toLowerCase()})` }] : []),
    ...custom,
  ];
  // Drop a filter that duplicates the status option.
  const seen = new Set<string>();
  const uniqueDims = dims.filter((d) => {
    const k = d.label.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const things: Thing3D[] = list.map((t) => {
    const m = monthOf(cfg.dateFilter?.get(t));
    const groups: Record<string, string> = { project: t.projectName, month: m ? monthLabel(m) : "No date" };
    if (cfg.statusOf) groups.status = cfg.statusOf(t) || "Not set";
    for (const d of cfg.filters) {
      const v = dimValues(d, t)[0] ?? "";
      groups[`f:${d.id}`] = (d.format ? d.format(v) : v) || "Not set";
    }
    if (cfg.overdue) groups.due = dueStatus(cfg.overdue.dueOf(t), cfg.isOpen(t), now);
    withCustom(groups, cfg.customOf?.(t), custom);
    const number = cfg.overdue?.numberOf(t);
    const href = cfg.linkOf(t);
    return {
      key: t.key,
      title: cfg.overdue?.titleOf(t) || "(untitled)",
      subtitle: `${number ? `#${String(number).replace(/^#/, "")} · ` : ""}${t.projectName}`,
      ...(href ? { href } : {}),
      projectId: t.projectId,
      projectName: t.projectName,
      ...(m ? { month: m } : {}),
      groups,
      props: props(
        [
          ["Project", t.projectName],
          ...(cfg.overdue ? ([["Due", groups.due]] as Array<[string, string]>) : []),
          ...cfg.columns.map((c) => [c.label, c.value(t, now)] as [string, string]),
        ],
        cfg.customOf?.(t),
      ),
    };
  });
  return { title: title ?? cfg.title, noun: cfg.noun, dims: uniqueDims, things, locations: locs(locations) };
}
