import { describe, expect, it } from "vitest";
import {
  dueStatus,
  footprint,
  groupThings,
  layout,
  OTHER_COLOUR,
  PITCH,
  SHAPES,
  spreadOnSphere,
  type Thing3D,
  type Universe3D,
} from "./universe";

function thing(i: number, groups: Record<string, string>, extra: Partial<Thing3D> = {}): Thing3D {
  return { key: `p:${i}`, title: `T${i}`, subtitle: "", projectId: "p", projectName: "P", groups, ...extra };
}

function universe(things: Thing3D[]): Universe3D {
  return { title: "T", noun: "issues", dims: [{ id: "status", label: "Status" }], things, locations: { p: { lat: 51.5, lon: -0.1 } } };
}

describe("groupThings", () => {
  it("ranks groups by size and keeps each group's records together", () => {
    const things = ["Open", "Closed", "Open", "Draft", "Open", "Closed"].map((s, i) => thing(i, { status: s }));
    const g = groupThings(things, "status");
    expect(g.groups.map((x) => [x.label, x.count])).toEqual([
      ["Open", 3],
      ["Closed", 2],
      ["Draft", 1],
    ]);
    const orderGroups = g.order.map((i) => g.groupOf[i]);
    expect(orderGroups).toEqual([0, 0, 0, 1, 1, 2]);
  });

  it("folds groups past the eleventh into a grey Other", () => {
    const things = Array.from({ length: 20 }, (_, i) => thing(i, { status: `S${i}` }));
    const g = groupThings(things, "status");
    expect(g.groups).toHaveLength(11);
    expect(g.groups[10]).toMatchObject({ label: "Other", count: 10, colour: OTHER_COLOUR });
  });

  it("keeps months in calendar order and folds older ones into Earlier", () => {
    const months = Array.from({ length: 14 }, (_, i) => `2025-${String((i % 12) + 1).padStart(2, "0")}`);
    const things = months.map((m, i) => thing(i, { month: `M${String(i).padStart(2, "0")}` }, { month: i >= 12 ? `2026-0${i - 11}` : m }));
    const g = groupThings(things, "month");
    expect(g.groups[0]?.label).toBe("Earlier");
    expect(g.groups.at(-1)?.label).toBe("M13");
  });

  it("treats a missing value as Not set", () => {
    const g = groupThings([thing(0, {})], "status");
    expect(g.groups[0]?.label).toBe("Not set");
  });
});

describe("layouts", () => {
  const things = Array.from({ length: 120 }, (_, i) => thing(i, { status: i < 80 ? "Open" : "Closed" }, { month: `2026-0${(i % 6) + 1}` }));
  const u = universe(things);
  const g = groupThings(things, "status");

  it("gives every record a finite position in every shape", () => {
    for (const s of SHAPES) {
      const l = layout(s.id, u, g);
      expect(l.pos).toHaveLength(things.length * 3);
      expect([...l.pos].every(Number.isFinite)).toBe(true);
      expect(l.radius).toBeGreaterThan(0);
    }
  });

  it("stacks towers in proportion: twice the records, about twice the height", () => {
    const l = layout("towers", u, g);
    const top = (gi: number) => Math.max(...g.order.filter((i) => g.groupOf[i] === gi).map((i) => l.pos[i * 3 + 1] as number));
    const s = footprint(80);
    expect(top(0)).toBeCloseTo((Math.ceil(80 / (s * s)) - 0.5) * PITCH);
    expect(top(1)).toBeCloseTo((Math.ceil(40 / (s * s)) - 0.5) * PITCH);
  });

  it("never puts two records in the same tower slot", () => {
    const l = layout("towers", u, g);
    const keys = new Set<string>();
    for (let i = 0; i < things.length; i++) keys.add(`${l.pos[i * 3]?.toFixed(2)},${l.pos[i * 3 + 1]?.toFixed(2)},${l.pos[i * 3 + 2]?.toFixed(2)}`);
    expect(keys.size).toBe(things.length);
  });

  it("puts records on the globe's surface facing outwards", () => {
    const l = layout("globe", u, g);
    expect(l.up).not.toBeNull();
    const up = l.up as Float32Array;
    expect(Math.hypot(up[0] as number, up[1] as number, up[2] as number)).toBeCloseTo(1);
  });
});

describe("dueStatus", () => {
  const now = new Date("2026-11-04T12:00:00Z");
  it("buckets by due date", () => {
    expect(dueStatus("2026-11-01", true, now)).toBe("Overdue");
    expect(dueStatus("2026-11-08", true, now)).toBe("Due in 7 days");
    expect(dueStatus("2026-12-25", true, now)).toBe("Due later");
    expect(dueStatus(undefined, true, now)).toBe("No due date");
    expect(dueStatus("2026-11-01", false, now)).toBe("Closed");
  });
});

describe("spreadOnSphere", () => {
  it("separates stacks that would overlap and leaves distant ones alone", () => {
    const [a, b, c] = spreadOnSphere(
      [
        [0, 0, 1],
        [0, 0.001, 0.9999995],
        [1, 0, 0],
      ],
      [0.05, 0.05, 0.05],
    );
    const ang = (p: number[], q: number[]) => Math.acos(Math.min(1, p[0]! * q[0]! + p[1]! * q[1]! + p[2]! * q[2]!));
    expect(ang(a!, b!)).toBeGreaterThanOrEqual(0.099);
    expect(c).toEqual([1, 0, 0]);
  });
});
