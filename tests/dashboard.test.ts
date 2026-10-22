import { describe, expect, it } from "vitest";
import { normaliseIssue } from "@/lib/dashboard/normalise";
import {
  ageing,
  applyFilters,
  countBy,
  isOverdue,
  kpis,
  monthlyTrend,
  statusByProject,
} from "@/lib/dashboard/aggregate";
import { deleteSet, loadSets, saveSet, storageKey } from "@/lib/dashboard/project-sets";
import { makeSnapshot, parseSnapshot } from "@/lib/dashboard/snapshot";
import { demoDataset } from "@/lib/dashboard/demo";
import { fieldCoverage } from "@/lib/aps/probe";
import { EMPTY_FILTERS, type IssueRecord } from "@/lib/dashboard/types";
import { buildUserRoster, type ProjectUser } from "@/lib/aps/users";

const NOW = new Date("2026-10-22T12:00:00Z");

const ctx = {
  projectId: "p1",
  projectName: "Project One",
  lookups: { types: { t1: "Design" }, subtypes: { s1: "Clash" }, rootCauses: { r1: "Coordination" } },
  directory: {
    // Issues reference people by Autodesk id; the roster is keyed by both
    // the project user id and the Autodesk id.
    people: buildUserRoster([
      { id: "proj-guid-1", name: "Alex Smith", autodeskId: "GWJJ9C7MQG439PNK" } as ProjectUser,
    ]),
    companies: new Map([["c1", "Acme Ltd"]]),
    roles: new Map([["r9", "Architect"]]),
  },
  attrs: {
    a1: { name: "Package", options: {} },
    a2: { name: "Discipline", options: { o1: "Structural", o2: "MEP" } },
  },
  locations: { l1: "Block A > Level 2" },
};

function issue(over: Partial<IssueRecord>): IssueRecord {
  return {
    key: `p1:${over.id ?? "x"}`,
    id: "x",
    projectId: "p1",
    projectName: "Project One",
    displayId: "1",
    title: "T",
    status: "open",
    typeName: "Design",
    subtypeName: "Clash",
    rootCause: "Not set",
    createdAt: "2026-10-01T00:00:00Z",
    commentCount: 0,
    attachmentCount: 0,
    hasViewpoint: false,
    custom: {},
    ...over,
  };
}

describe("normaliseIssue", () => {
  it("resolves lookups, users, custom attributes and viewpoints", () => {
    const n = normaliseIssue(
      {
        id: "i1",
        displayId: 12,
        title: "Duct clash",
        status: "in_review",
        issueTypeId: "t1",
        issueSubtypeId: "s1",
        rootCauseId: "r1",
        assignedTo: "GWJJ9C7MQG439PNK",
        assignedToType: "user",
        createdBy: "GWJJ9C7MQG439PNK",
        createdAt: "2026-09-01T00:00:00Z",
        linkedDocuments: [{ type: "TwoDVectorPushpin" }],
        locationId: "l1",
        customAttributes: [
          { attributeDefinitionId: "a1", value: "M&E" },
          { attributeDefinitionId: "a2", value: "o2" },
        ],
      },
      ctx,
    );
    expect(n).toMatchObject({
      key: "p1:i1",
      displayId: "12",
      typeName: "Design",
      subtypeName: "Clash",
      rootCause: "Coordination",
      assignee: { id: "GWJJ9C7MQG439PNK", name: "Alex Smith", kind: "user" },
      createdBy: "Alex Smith",
      hasViewpoint: true,
      location: "Block A > Level 2",
      custom: { Package: "M&E", Discipline: "MEP" },
    });
  });

  it("resolves company and role assignees", () => {
    expect(normaliseIssue({ id: "a", assignedTo: "c1", assignedToType: "company" }, ctx)?.assignee?.name).toBe("Acme Ltd");
    expect(normaliseIssue({ id: "b", assignedTo: "r9", assignedToType: "role" }, ctx)?.assignee?.name).toBe("Architect");
  });

  it("labels unresolved ids instead of showing them raw", () => {
    const n = normaliseIssue({ id: "i2", assignedTo: "ZZZZ9999XXXX", assignedToType: "user", createdBy: "QQQQ1111" }, ctx);
    expect(n?.typeName).toBe("Unspecified");
    expect(n?.rootCause).toBe("Not set");
    expect(n?.assignee?.name).toBe("Unknown user (ZZZZ99)");
    expect(n?.createdBy).toBe("Unknown user (QQQQ11)");
    expect(normaliseIssue({ id: "c", assignedTo: "c404abc", assignedToType: "company" }, ctx)?.assignee?.name).toBe("Company (c404ab)");
  });

  it("drops records without an id", () => {
    expect(normaliseIssue({ title: "x" }, ctx)).toBeNull();
    expect(normaliseIssue(null, ctx)).toBeNull();
  });
});

describe("aggregations", () => {
  const data = [
    issue({ id: "1", status: "open", dueDate: "2026-10-01" }),
    issue({ id: "2", status: "in_progress", dueDate: "2026-10-22" }),
    issue({ id: "3", status: "closed", dueDate: "2026-01-01", createdAt: "2026-09-01T00:00:00Z", closedAt: "2026-09-11T00:00:00Z" }),
    issue({ id: "4", status: "completed", projectId: "p2", projectName: "Two", hasViewpoint: true }),
  ];

  it("counts overdue only for outstanding issues past their due day", () => {
    expect(isOverdue(data[0] as IssueRecord, NOW)).toBe(true);
    expect(isOverdue(data[1] as IssueRecord, NOW)).toBe(false); // due today
    expect(isOverdue(data[2] as IssueRecord, NOW)).toBe(false); // closed
  });

  it("computes KPIs", () => {
    expect(kpis(data, NOW)).toEqual({
      total: 4,
      outstanding: 2,
      overdue: 1,
      closed: 2,
      avgDaysToClose: 10,
      withViewpoint: 1,
    });
  });

  it("folds long tails into Other", () => {
    const many = Array.from({ length: 12 }, (_, i) => issue({ id: String(i), typeName: `T${i}` }));
    const c = countBy(many, (i) => i.typeName, 5);
    expect(c).toHaveLength(5);
    expect(c[4]).toEqual({ label: "Other", count: 8 });
  });

  it("groups status by project", () => {
    const rows = statusByProject(data, NOW);
    expect(rows[0]).toMatchObject({ projectId: "p1", total: 3, overdue: 1, counts: { open: 1, inProgress: 1, completed: 0, closed: 1 } });
  });

  it("gap-fills the monthly trend", () => {
    const t = monthlyTrend([
      issue({ id: "a", createdAt: "2026-07-03T00:00:00Z" }),
      issue({ id: "b", createdAt: "2026-09-03T00:00:00Z", closedAt: "2026-09-20T00:00:00Z" }),
    ]);
    expect(t.map((p) => p.month)).toEqual(["2026-07", "2026-08", "2026-09"]);
    expect(t[2]).toEqual({ month: "2026-09", created: 1, closed: 1 });
  });

  it("buckets ages of outstanding issues", () => {
    const a = ageing([issue({ createdAt: "2026-10-20T00:00:00Z" }), issue({ createdAt: "2025-01-01T00:00:00Z" })], NOW);
    expect(a[0]?.count).toBe(1);
    expect(a[4]?.count).toBe(1);
  });

  it("applies filters", () => {
    expect(applyFilters(data, { ...EMPTY_FILTERS, projectIds: ["p2"] })).toHaveLength(1);
    expect(applyFilters(data, { ...EMPTY_FILTERS, statuses: ["open", "closed"] })).toHaveLength(2);
    expect(applyFilters(data, { ...EMPTY_FILTERS, assignees: ["Unassigned"] })).toHaveLength(4);
  });
});

class MemStore implements Storage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.get(k) ?? null; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, v); }
}

describe("project sets", () => {
  it("are isolated per user and upsert by name within a hub", () => {
    const s = new MemStore();
    saveSet("alice", { name: "North", hubId: "h", projects: [{ id: "1", name: "One" }] }, s);
    saveSet("alice", { name: "north ", hubId: "h", projects: [{ id: "2", name: "Two" }] }, s);
    expect(loadSets("alice", s)).toHaveLength(1);
    expect(loadSets("alice", s)[0]?.projects[0]?.id).toBe("2");
    expect(loadSets("bob", s)).toEqual([]);
    const id = loadSets("alice", s)[0]?.id as string;
    expect(deleteSet("alice", id, s)).toEqual([]);
  });

  it("survives corrupt storage", () => {
    const s = new MemStore();
    s.setItem(storageKey("alice"), "{not json");
    expect(loadSets("alice", s)).toEqual([]);
  });
});

describe("snapshots", () => {
  const ds = {
    version: 1 as const,
    generatedAt: NOW.toISOString(),
    hubId: "b.hub",
    projects: [{ id: "p1", name: "One", issueCount: 2 }],
    issues: [
      issue({ id: "1", description: "secret", assignee: { id: "u1", name: "Alex", kind: "user" }, createdBy: "Alex", custom: { Cost: "1000" } }),
      issue({ id: "2", assignee: { id: "c1", name: "Acme Ltd", kind: "company" } }),
    ],
  };

  it("redacts by default options", () => {
    const s = makeSnapshot(ds, { includeDescriptions: false, anonymisePeople: true, includeCustomFields: false }, NOW);
    expect(s.hubId).toBe("");
    expect(s.issues[0]?.description).toBeUndefined();
    expect(s.issues[0]?.assignee).toEqual({ id: "", name: "Person 1", kind: "user" });
    expect(s.issues[0]?.createdBy).toBe("Person 1");
    expect(s.issues[0]?.custom).toEqual({});
    expect(s.issues[1]?.assignee?.name).toBe("Acme Ltd");
  });

  it("round-trips through parseSnapshot and rejects junk", () => {
    const s = makeSnapshot(ds, { includeDescriptions: true, anonymisePeople: false, includeCustomFields: true }, NOW);
    expect(parseSnapshot(JSON.parse(JSON.stringify(s)))).toEqual(s);
    expect(() => parseSnapshot({ version: 2 })).toThrow();
  });

  it("demo dataset is a valid snapshot", () => {
    const d = demoDataset(NOW);
    expect(d.issues.length).toBeGreaterThan(100);
    expect(parseSnapshot(JSON.parse(JSON.stringify(d))).issues).toHaveLength(d.issues.length);
  });
});

describe("probe field coverage", () => {
  it("reports share of records with each field populated", () => {
    expect(fieldCoverage([{ a: 1, b: "" }, { a: 2, b: "x", c: [] }])).toEqual([
      { field: "a", share: 1 },
      { field: "b", share: 0.5 },
      { field: "c", share: 0 },
    ]);
  });
});

describe("issue attribute definitions", () => {
  it("maps Issues title/dataType/list options onto the shared parser", async () => {
    const { issueAttrToRaw } = await import("@/lib/aps/issues");
    const { parseAttributeDefs } = await import("@/lib/aps/rfis");
    const defs = parseAttributeDefs([
      issueAttrToRaw({ id: "a2", title: "Discipline", dataType: "list", metadata: { list: { options: [{ id: "o1", value: "Structural" }] } } }),
      issueAttrToRaw({ id: "a3", title: "Cost", dataType: "numeric" }),
    ]);
    expect(defs).toEqual([
      { id: "a2", name: "Discipline", dataType: "singleChoice", values: [{ id: "o1", label: "Structural" }] },
      { id: "a3", name: "Cost", dataType: "numeric" },
    ]);
  });
});
