import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// public/maplibre-gl-worker.mjs is a copy of the installed MapLibre's worker
// (see project-map.tsx). After upgrading maplibre-gl, copy it again:
//   cp node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs public/
describe("MapLibre worker copy", () => {
  it("matches the installed maplibre-gl version", () => {
    const installed = readFileSync("node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", "utf8");
    const served = readFileSync("public/maplibre-gl-worker.mjs", "utf8");
    expect(served === installed).toBe(true);
  });
});
