import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { isSubmittalOverdue, normaliseSubmittal, submittalsConfig, type SubmittalRecord } from "@/lib/submittals/config";
import { scanProject } from "@/lib/aps/scan";
import { ApsError } from "@/lib/aps/types";
import type { ApsClient } from "@/lib/aps/client";
import { GenericView } from "@/components/generic/generic-view";

const NOW = new Date("2026-10-23T12:00:00Z");
const ctx = {
  projectId: "p1",
  projectName: "P",
  lookups: { types: { t1: "Shop drawing" }, statuses: {}, responses: { r1: "Approved" } },
  names: new Map([["U1", "Pat Smith"], ["R1", "Architect"]]),
};

describe("submittals", () => {
  it("normalises documented fields with default status labels", () => {
    const s = normaliseSubmittal(
      {
        id: "s1", identifier: 12, title: "Curtain wall", statusId: "2", stateId: "rev", typeId: "t1",
        specIdentifier: "08 44 13", ballInCourtUsers: ["U1"], ballInCourtRoles: [{ id: "R1" }],
        requiredApprovalDate: "2026-10-01", createdAt: "2026-09-01T00:00:00Z", responseId: "r1",
      },
      ctx,
    ) as SubmittalRecord;
    expect(s).toMatchObject({
      number: "12", status: "Open", state: "In review", type: "Shop drawing", spec: "08 44 13",
      ballInCourt: "Pat Smith, Architect", response: "Approved", dueDate: "2026-10-01",
    });
    expect(isSubmittalOverdue(s, NOW)).toBe(true);
    expect(isSubmittalOverdue({ ...s, status: "Closed" }, NOW)).toBe(false);
    expect(normaliseSubmittal({ title: "no id" }, ctx)).toBeNull();
    const html = renderToString(<GenericView cfg={submittalsConfig} dataset={{ projects: [{ id: "p1", name: "P", count: 1 }], items: [s] }} now={NOW} />);
    expect(html).toContain("Curtain wall");
  });
});

describe("data availability scan", () => {
  it("reads totals and classifies failures", async () => {
    const client = {
      request: async ({ path, method }: { path: string; method?: string }) => {
        if (path.includes("/issues")) return { pagination: { totalResults: 157 }, results: [{}] };
        if (path.includes("search:rfis")) {
          expect(method).toBe("POST");
          return { results: [] };
        }
        if (path.includes("/forms")) return { data: [{}], pagination: { totalResults: 294 } };
        if (path.includes("/reviews")) throw new ApsError("forbidden", 403);
        throw new ApsError("not found", 404);
      },
    } as unknown as ApsClient;
    expect(await scanProject(client, "b.p1")).toEqual({ Issues: 157, RFIs: 0, Forms: 294, Reviews: "no access", Submittals: "off" });
  });
});
