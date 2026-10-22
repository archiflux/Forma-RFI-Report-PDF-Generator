// Deterministic fake dataset for previewing the dashboard without an
// Autodesk sign-in. Not real project data.

import type { DashboardDataset, IssueRecord } from "./types";

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const PROJECTS = ["Demo - Riverside Health Centre", "Demo - Northgate School", "Demo - Harbour Offices", "Demo - Mill Lane Housing"];
const TYPES: Array<[string, string[]]> = [
  ["Design", ["Clash", "Coordination", "Design query"]],
  ["Quality", ["Snag", "Defect", "Non-conformance"]],
  ["Safety", ["Observation", "Hazard"]],
  ["Commissioning", ["Punch item"]],
];
const CAUSES = ["Design error", "Coordination", "Workmanship", "Client change", "Not set"];
const PEOPLE = ["Person A", "Person B", "Person C", "Person D", "Person E", "Person F"];
const STATUSES = ["open", "open", "in_progress", "in_review", "pending", "completed", "closed", "closed", "closed", "draft"];

export function demoDataset(now = new Date("2026-10-22T09:00:00Z")): DashboardDataset {
  const r = rng(42);
  const pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length)] as T;
  const issues: IssueRecord[] = [];
  PROJECTS.forEach((projectName, pi) => {
    const projectId = `demo-${pi + 1}`;
    const n = 40 + Math.floor(r() * 80);
    for (let k = 1; k <= n; k++) {
      const created = new Date(now.getTime() - r() * 420 * 86_400_000);
      const status = pick(STATUSES);
      const done = status === "closed" || status === "completed";
      const closed = done ? new Date(Math.min(now.getTime(), created.getTime() + r() * 90 * 86_400_000)) : undefined;
      const due = new Date(created.getTime() + (7 + r() * 60) * 86_400_000);
      const [typeName, subs] = pick(TYPES);
      issues.push({
        key: `${projectId}:${k}`,
        id: String(k),
        projectId,
        projectName,
        displayId: String(k),
        title: `${pick(subs)} at level ${1 + Math.floor(r() * 5)}, grid ${String.fromCharCode(65 + Math.floor(r() * 8))}${1 + Math.floor(r() * 9)}`,
        status,
        typeName,
        subtypeName: pick(subs),
        rootCause: pick(CAUSES),
        assignee: r() < 0.85 ? { id: "", name: pick(PEOPLE), kind: "user" } : undefined,
        createdAt: created.toISOString(),
        dueDate: due.toISOString().slice(0, 10),
        ...(closed ? { closedAt: closed.toISOString() } : {}),
        commentCount: Math.floor(r() * 6),
        attachmentCount: Math.floor(r() * 3),
        hasViewpoint: r() < 0.6,
        custom: {},
      });
    }
  });
  return {
    version: 1,
    generatedAt: now.toISOString(),
    hubId: "demo",
    title: "Demo data",
    projects: PROJECTS.map((name, i) => ({
      id: `demo-${i + 1}`,
      name,
      issueCount: issues.filter((x) => x.projectId === `demo-${i + 1}`).length,
    })),
    issues,
  };
}
