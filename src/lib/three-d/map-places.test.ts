import { describe, expect, it } from "vitest";
import { mapPlaces } from "./map-places";
import { groupThings, hasLocations, type Thing3D, type Universe3D } from "./universe";

function thing(key: string, projectId: string, status: string, place?: Thing3D["place"]): Thing3D {
  return { key, title: key, subtitle: "", projectId, projectName: `Project ${projectId}`, groups: { status }, props: [], ...(place ? { place } : {}) };
}

const u: Universe3D = {
  title: "Forms",
  noun: "forms",
  dims: [{ id: "status", label: "Status" }],
  things: [
    thing("a", "p1", "Open"),
    thing("b", "p1", "Open"),
    thing("c", "p1", "Closed"),
    thing("d", "p2", "Closed", { id: "pc:UB6 8UJ", name: "Unit 1 (UB6 8UJ)", lat: 51.53, lon: -0.33 }),
    thing("e", "p3", "Open"),
  ],
  locations: { p1: { lat: 50.4, lon: -4.1 }, p2: null, p3: null },
};

describe("mapPlaces", () => {
  it("makes one pin per place, using a record's own place before its project's", () => {
    const g = groupThings(u.things, "status");
    const m = mapPlaces(u, g, null);
    expect(m.geojson.features.map((f) => f.properties.name).sort()).toEqual(["Project p1", "Unit 1 (UB6 8UJ)"]);
    const p1 = m.geojson.features.find((f) => f.properties.id === "p1")?.properties;
    const open = g.groups.findIndex((x) => x.label === "Open");
    expect(p1?.total).toBe(3);
    expect(p1?.[`g${open}`]).toBe(2);
    // Cluster totals add up per group, so clusters can be coloured too.
    expect(m.clusterProperties[`g${open}`]).toEqual(["+", ["get", `g${open}`]]);
    expect(m.describe(p1 ?? {}).rows[0]).toEqual(["Forms", "3"]);
  });

  it("counts only the highlighted group", () => {
    const g = groupThings(u.things, "status");
    const closed = g.groups.findIndex((x) => x.label === "Closed");
    const m = mapPlaces(u, g, closed);
    expect(m.geojson.features.map((f) => f.properties.total)).toEqual([1, 1]);
    expect(m.colour).toBe(g.groups[closed]?.colour);
  });

  it("treats a record with its own place as located", () => {
    expect(hasLocations({ ...u, locations: {}, things: [u.things[3] as Thing3D] })).toBe(true);
  });
});
