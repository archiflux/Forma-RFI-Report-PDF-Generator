import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { parseLocation } from "@/lib/aps/project-location";
import { fitView, globePoints, heatColour, HEAT_RAMP } from "@/lib/dashboard/globe";
import { ProjectGlobe } from "@/components/dashboard/project-globe";

describe("project locations", () => {
  it("parses Admin API coordinates and rejects placeholders", () => {
    expect(parseLocation({ latitude: "50.37", longitude: "-4.14", city: "Plymouth" })).toEqual({ lat: 50.37, lon: -4.14, city: "Plymouth" });
    expect(parseLocation({ latitude: 0, longitude: 0 })).toBeNull();
    expect(parseLocation({ latitude: null, longitude: "1" })).toBeNull();
    expect(parseLocation({ latitude: "abc", longitude: "1" })).toBeNull();
    expect(parseLocation({ latitude: 95, longitude: 1 })).toBeNull();
  });
});

describe("globe maths", () => {
  it("builds one point per mapped project and counts the unmapped", () => {
    const items = [
      { projectId: "a", open: true },
      { projectId: "a", open: false },
      { projectId: "b", open: true },
      { projectId: "c", open: true },
    ];
    const r = globePoints(
      items,
      [{ id: "a", name: "A" }, { id: "b", name: "B" }, { id: "c", name: "C" }, { id: "d", name: "D" }],
      { a: { lat: 50, lon: -4 }, b: null, c: { lat: 51, lon: -2 }, d: { lat: 1, lon: 1 } },
      (t) => t.open,
    );
    expect(r.points.map((p) => [p.id, p.total, p.open])).toEqual([["a", 2, 1], ["c", 1, 1]]);
    expect(r.unmapped).toBe(1); // b has items but no location; d has no items
  });

  it("centres on the points and zooms in further for tight clusters", () => {
    const uk = fitView([{ lat: 50.4, lon: -4.1 }, { lat: 51.5, lon: -2.6 }]);
    expect(uk.lat).toBeGreaterThan(50);
    expect(uk.lat).toBeLessThan(51.5);
    expect(uk.zoom).toBeGreaterThan(10);
    const world = fitView([{ lat: 51, lon: 0 }, { lat: 40, lon: -74 }]);
    expect(world.zoom).toBeLessThan(3);
    expect(fitView([])).toEqual({ lon: 0, lat: 20, zoom: 1 });
    // Averages across the antimeridian instead of landing on the far side.
    expect(Math.abs(fitView([{ lat: 0, lon: 179 }, { lat: 0, lon: -179 }]).lon)).toBeGreaterThan(170);
  });

  it("maps open counts onto the ramp, lightest to darkest", () => {
    expect(heatColour(0, 10)).toBe(HEAT_RAMP[0]);
    expect(heatColour(10, 10)).toBe(HEAT_RAMP[HEAT_RAMP.length - 1]);
    expect(heatColour(5, 0)).toBe(HEAT_RAMP[0]);
  });

  it("renders without data and explains unmapped projects", () => {
    const html = renderToString(<ProjectGlobe points={[]} unmapped={2} noun="issues" />).replace(/<!-- -->/g, "");
    expect(html).toContain("2 projects have no location set in Forma");
    expect(html).toContain("No mapped projects in this view.");
  });
});
