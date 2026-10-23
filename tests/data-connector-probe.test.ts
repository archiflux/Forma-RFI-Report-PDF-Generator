import { describe, expect, it } from "vitest";
import { runDataConnectorCheck } from "@/lib/aps/probe";
import { ApsError } from "@/lib/aps/types";
import type { ApsClient } from "@/lib/aps/client";

function fakeClient(routes: Record<string, unknown>): { client: ApsClient; calls: string[] } {
  const calls: string[] = [];
  const client = {
    request: async ({ path, method }: { path: string; method?: string }) => {
      calls.push(`${method ?? "GET"} ${path}`);
      if (path in routes) {
        const v = routes[path];
        if (v instanceof ApsError) throw v;
        return v;
      }
      throw new ApsError("not found", 404);
    },
  } as unknown as ApsClient;
  return { client, calls };
}

const base = "/data-connector/v1/accounts/acc-1";

describe("Data Connector probe", () => {
  it("walks requests, jobs, listing and a signed URL using GET only", async () => {
    const { client, calls } = fakeClient({
      [`${base}/requests`]: { results: [{ id: "req1", description: "Daily hub", scheduleInterval: "DAY", createdAt: "2026-10-01" }] },
      [`${base}/requests/req1/jobs`]: { results: [{ id: "job1", status: "complete", completionStatus: "success", completedAt: "2026-10-22T02:00:00Z" }] },
      [`${base}/jobs/job1/data-listing`]: [{ name: "issues_issues.csv", size: 204800 }, { name: "admin_projects.csv", size: 2048 }],
      [`${base}/jobs/job1/data/admin_projects.csv`]: { signedUrl: "https://bucket.s3.amazonaws.com/x?sig=1" },
    });
    const rows = await runDataConnectorCheck(client, "b.acc-1");
    expect(rows.map((r) => [r.id, r.status])).toEqual([
      ["dc-requests", 200],
      ["dc-jobs", 200],
      ["dc-listing", 200],
      ["dc-signed-url", 200],
    ]);
    expect(rows[2]?.notes).toEqual(["issues_issues.csv (200 KB)", "admin_projects.csv (2 KB)"]);
    expect(rows[3]?.notes).toEqual(["Signed URL host: bucket.s3.amazonaws.com"]);
    expect(rows[3]?.sample).toBeUndefined();
    expect(calls.every((c) => c.startsWith("GET "))).toBe(true);
  });

  it("stops with a clear row when access is denied", async () => {
    const { client } = fakeClient({ [`${base}/requests`]: new ApsError("forbidden", 403) });
    const rows = await runDataConnectorCheck(client, "b.acc-1");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe(403);
  });

  it("explains when the user has no requests", async () => {
    const { client } = fakeClient({ [`${base}/requests`]: { results: [] } });
    const rows = await runDataConnectorCheck(client, "b.acc-1");
    expect(rows[0]?.notes?.[0]).toMatch(/No extraction requests/);
  });
});
