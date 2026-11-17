import { describe, expect, it } from "vitest";
import { normaliseForm } from "@/lib/forms/normalise";
import { sitePoints } from "@/lib/dashboard/globe";
import { geocode } from "./geocode-handler";

const ctx = {
  projectId: "p1",
  projectName: "Survey Results",
  templates: {},
  people: new Map<string, string>(),
  locations: { L1: "Bath Road Retail Park > UK770000010 - 312 Bath Road - SL1 4DX", L2: "SEGRO Centre Dagenham" },
};

describe("forms on the map", () => {
  it("takes the postcode from the form's Forma location", () => {
    const f = normaliseForm({ id: "f1", name: "Survey", status: "open", locationId: "L1" }, ctx);
    expect(f?.location).toBe("Bath Road Retail Park > UK770000010 - 312 Bath Road - SL1 4DX");
    expect(f?.postcode).toBe("SL1 4DX");
  });

  it("falls back to the form's name, then its answers", () => {
    expect(normaliseForm({ id: "f2", name: "Survey - RM9 6FF", locationId: "L2" }, ctx)?.postcode).toBe("RM9 6FF");
    expect(
      normaliseForm({ id: "f3", name: "Survey", customValues: [{ itemLabel: "Address", textVal: "Unit 1, Orion Park, RM9 6FF" }] }, ctx)?.postcode,
    ).toBe("RM9 6FF");
    expect(normaliseForm({ id: "f4", name: "Survey" }, ctx)?.postcode).toBeUndefined();
  });

  it("pins forms by site, and the rest by project", () => {
    const forms = [
      { projectId: "p1", postcode: "SL1 4DX", location: "Park > 312 Bath Road - SL1 4DX", open: true },
      { projectId: "p1", postcode: "SL1 4DX", location: "Park > 312 Bath Road - SL1 4DX", open: false },
      { projectId: "p1", postcode: "ZZ9 9ZZ", open: true },
      { projectId: "p1", open: true },
    ];
    const r = sitePoints(forms, [{ id: "p1", name: "Survey Results" }], { p1: { lat: 51, lon: -1 } }, { "SL1 4DX": { lat: 51.5, lon: -0.6 }, "ZZ9 9ZZ": null }, (x) => x.open);
    const site = r.points.find((p) => p.id === "pc:SL1 4DX");
    expect(site).toMatchObject({ name: "312 Bath Road - SL1 4DX", total: 2, open: 1 });
    expect(r.points.find((p) => p.id === "p1")).toMatchObject({ total: 2 });
    expect(r.sites).toBe(1);
  });
});

describe("postcode lookup endpoint", () => {
  const req = (body: unknown, header = true) =>
    new Request("https://siteboard.example/api/geocode", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(header ? { "x-siteboard": "1" } : {}) },
      body: JSON.stringify(body),
    });

  it("looks postcodes up, with the district centre for unknown ones", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: string) => {
      calls.push(url);
      if (url.endsWith("/postcodes")) {
        return new Response(JSON.stringify({ result: [{ query: "SL1 4DX", result: { latitude: 51.5, longitude: -0.6 } }, { query: "SL1 9ZZ", result: null }] }));
      }
      return new Response(JSON.stringify({ result: { latitude: 51.51, longitude: -0.61 } }));
    }) as unknown as typeof fetch;
    const res = await geocode(req({ postcodes: ["SL1 4DX", "SL1 9ZZ", "not a postcode"] }), fetchImpl);
    const { results } = (await res.json()) as { results: Record<string, unknown> };
    expect(results["SL1 4DX"]).toEqual({ lat: 51.5, lon: -0.6 });
    expect(results["SL1 9ZZ"]).toEqual({ lat: 51.51, lon: -0.61, approx: true });
    expect(calls.some((c) => c.endsWith("/outcodes/SL1"))).toBe(true);
  });

  it("refuses calls from outside the app and oversized batches", async () => {
    expect((await geocode(req({ postcodes: ["SL1 4DX"] }, false))).status).toBe(403);
    expect((await geocode(req({ postcodes: [] }))).status).toBe(400);
  });
});
