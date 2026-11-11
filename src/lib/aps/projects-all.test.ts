import { describe, expect, it } from "vitest";
import { ApsClient } from "./client";
import { listAllProjects } from "./projects";

function client(routes: Record<string, unknown | number>): ApsClient {
  const fetchImpl = (async (url: string) => {
    const path = new URL(url).pathname;
    const r = routes[path];
    if (typeof r === "number") return new Response("{}", { status: r });
    return new Response(JSON.stringify(r ?? { data: [] }), { status: 200 });
  }) as unknown as typeof fetch;
  return new ApsClient({ getAccessToken: () => "t", fetchImpl, baseUrl: "https://x.test", maxRetries: 0 });
}

const hub = (id: string, name: string, type: string) => ({ id, attributes: { name, extension: { type } } });

describe("listAllProjects", () => {
  it("lists projects from every Forma hub, tagged with the hub and sorted", async () => {
    const c = client({
      "/project/v1/hubs": { data: [hub("b.uk", "BP UK", "hubs:autodesk.bim360:Account"), hub("b.us", "BP US", "hubs:autodesk.bim360:Account"), hub("a.me", "Personal", "hubs:autodesk.a360:PersonalHub")] },
      "/project/v1/hubs/b.uk/projects": { data: [{ id: "b.p2", attributes: { name: "10 - Bridge" } }] },
      "/project/v1/hubs/b.us/projects": { data: [{ id: "b.p1", attributes: { name: "9 - Arch" } }] },
    });
    const r = await listAllProjects(c);
    expect(r.projects.map((p) => [p.name, p.hubName])).toEqual([
      ["9 - Arch", "BP US"],
      ["10 - Bridge", "BP UK"],
    ]);
    expect(r.hubs).toHaveLength(2);
  });

  it("keeps going when one hub fails", async () => {
    const c = client({
      "/project/v1/hubs": { data: [hub("b.uk", "BP UK", "hubs:autodesk.bim360:Account"), hub("b.eu", "BP EU", "hubs:autodesk.bim360:Account")] },
      "/project/v1/hubs/b.uk/projects": { data: [{ id: "b.p1", attributes: { name: "A" } }] },
      "/project/v1/hubs/b.eu/projects": 403,
    });
    const r = await listAllProjects(c);
    expect(r.projects.map((p) => p.name)).toEqual(["A"]);
    expect(r.failedHubs).toEqual(["BP EU"]);
  });
});
