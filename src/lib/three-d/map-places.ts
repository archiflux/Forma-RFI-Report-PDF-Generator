import { placeOf, type Grouping, type Universe3D } from "./universe";

// GeoJSON for the 3D view's street map: one pin per place, carrying how many
// of its records fall in each "Organise by" group (g0, g1, ...). Clusters
// add those counts up, so a cluster and a pin both take the colour of
// their most common group. With a group highlighted in the key, only that
// group's records count.
export function mapPlaces(u: Universe3D, g: Grouping, highlight: number | null) {
  const n = g.groups.length;
  const byPlace = new Map<string, { name: string; lat: number; lon: number; counts: number[] }>();
  u.things.forEach((t, i) => {
    const gi = g.groupOf[i] as number;
    if (highlight !== null && gi !== highlight) return;
    const pl = placeOf(t, u.locations);
    if (!pl) return;
    let e = byPlace.get(pl.id);
    if (!e) {
      e = { name: pl.name, lat: pl.lat, lon: pl.lon, counts: new Array(n).fill(0) };
      byPlace.set(pl.id, e);
    }
    e.counts[gi] = (e.counts[gi] ?? 0) + 1;
  });
  const features = [...byPlace.entries()].map(([id, e]) => {
    const props: Record<string, string | number> = { id, name: e.name, total: e.counts.reduce((a, b) => a + b, 0) };
    e.counts.forEach((c, i) => {
      props[`g${i}`] = c;
    });
    return { type: "Feature" as const, geometry: { type: "Point" as const, coordinates: [e.lon, e.lat] }, properties: props };
  });
  const clusterProperties: Record<string, unknown> = { total: ["+", ["get", "total"]] };
  for (let i = 0; i < n; i++) clusterProperties[`g${i}`] = ["+", ["get", `g${i}`]];

  // Colour of the largest group: a case expression testing each group
  // against all the others.
  let colour: unknown;
  if (highlight !== null) colour = g.groups[highlight]?.colour ?? "#ffffff";
  else if (n <= 1) colour = g.groups[0]?.colour ?? "#ffffff";
  else {
    const cases: unknown[] = ["case"];
    for (let i = 0; i < n - 1; i++) {
      const others = [];
      for (let j = 0; j < n; j++) if (j !== i) others.push([">=", ["get", `g${i}`], ["get", `g${j}`]]);
      cases.push(["all", ...others], g.groups[i]?.colour);
    }
    cases.push(g.groups[n - 1]?.colour);
    colour = cases;
  }

  const noun = u.noun.charAt(0).toUpperCase() + u.noun.slice(1);
  const describe = (p: Record<string, unknown>): { title: string; rows: Array<[string, string]> } => {
    const total = Number(p.total ?? 0);
    const counts = g.groups
      .map((grp, i) => [grp.label, Number(p[`g${i}`] ?? 0)] as const)
      .filter(([, c]) => c > 0)
      .sort((a, b) => b[1] - a[1]);
    const rows: Array<[string, string]> = [[noun, total.toLocaleString("en-GB")]];
    for (const [label, c] of counts.slice(0, 5)) rows.push([label, c.toLocaleString("en-GB")]);
    if (counts.length > 5) rows.push([`${counts.length - 5} more groups`, ""]);
    rows.push(["Click for the list", ""]);
    if (p.cluster) {
      return { title: `${Number(p.point_count ?? 0).toLocaleString("en-GB")} places close together`, rows };
    }
    return { title: String(p.name ?? ""), rows };
  };

  return {
    geojson: { type: "FeatureCollection" as const, features },
    clusterProperties,
    colour,
    maxTotal: Math.max(1, ...features.map((f) => Number(f.properties.total))),
    coords: features.map((f) => f.geometry.coordinates as [number, number]),
    describe,
  };
}
