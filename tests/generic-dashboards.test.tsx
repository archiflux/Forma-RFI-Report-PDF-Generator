import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { normaliseReview, isReviewOpen, isReviewOverdue, type ReviewRecord } from "@/lib/reviews/normalise";
import { reviewsConfig } from "@/lib/reviews/config";
import { isRfiOverdue, rfisConfig, toRfiRecord, type RfiRecord } from "@/lib/rfis-dash/config";
import { normalizeRfi } from "@/lib/aps/rfis";
import { applyGenericFilters, buildGenericReport } from "@/lib/generic/aggregate";
import { parseGenericDataset } from "@/lib/generic/snapshot";
import { EMPTY_GENERIC_FILTERS } from "@/lib/generic/types";
import { GenericView } from "@/components/generic/generic-view";
import { DashboardPdf } from "@/lib/report/dashboard/pdf";

const NOW = new Date("2026-10-23T12:00:00Z");
const ctx = {
  projectId: "p1",
  projectName: "Project One",
  workflows: { w1: "Two-step approval" },
  people: new Map([["ADSK1", "Sam Jones"]]),
};

const reviews = [
  normaliseReview(
    {
      id: "r1", sequenceId: 3, name: "Stage 4 drawings", status: "OPEN", workflowId: "w1",
      createdBy: { autodeskId: "ADSK1" }, createdAt: "2026-09-01T09:00:00Z", currentStepDueDate: "2026-10-01",
      nextActionBy: { candidates: { users: [{ autodeskId: "X", name: "Alex Lee" }], roles: [{ id: "r", name: "Architect" }] } },
    },
    ctx,
  ),
  normaliseReview(
    { id: "r2", sequenceId: 4, name: "Specs", status: "CLOSED", workflowId: "w9", createdBy: "ADSK1", createdAt: "2026-08-01T00:00:00Z", finishedAt: "2026-08-11T00:00:00Z", approvedAt: "2026-08-11T00:00:00Z" },
    ctx,
  ),
] as ReviewRecord[];

describe("reviews", () => {
  it("normalises names, workflow and who it's waiting on", () => {
    expect(reviews[0]).toMatchObject({
      key: "p1:r1", sequenceId: "3", workflow: "Two-step approval", createdBy: "Sam Jones",
      dueDate: "2026-10-01", nextActionBy: "Alex Lee, Architect",
    });
    expect(reviews[1]).toMatchObject({ workflow: "Unknown workflow", createdBy: "Sam Jones" });
    expect(normaliseReview({ name: "no id" }, ctx)).toBeNull();
  });

  it("works out open and overdue", () => {
    expect(isReviewOpen(reviews[0] as ReviewRecord)).toBe(true);
    expect(isReviewOverdue(reviews[0] as ReviewRecord, NOW)).toBe(true);
    expect(isReviewOpen(reviews[1] as ReviewRecord)).toBe(false);
  });

  it("KPIs and redaction", () => {
    expect(reviewsConfig.kpis(reviews, NOW).map((k) => k.value)).toEqual(["2", "1", "1", "1", "1", "10.0"]);
    const red = reviewsConfig.redact({ projects: [], items: reviews });
    expect(red.items[0]?.createdBy).toBe("Person 1");
    expect(red.items[1]?.createdBy).toBe("Person 1");
    expect(red.items[0]?.nextActionBy).toBe("Person 2, Person 3");
  });
});

describe("RFIs", () => {
  const rfi = (over: Record<string, unknown>) =>
    toRfiRecord(
      normalizeRfi({ id: "x", customIdentifier: "RFI-1", title: "Lintel", status: "open", createdAt: "2026-09-01T00:00:00Z", ...over }),
      "p1",
      "Project One",
      new Map([["u", "Pat"]]),
    );

  it("maps ball in court and works out overdue", () => {
    const r = rfi({ dueDate: "2026-10-01", ballInCourt: [{ id: "u", name: "Pat" }] });
    expect(r).toMatchObject({ number: "RFI-1", ballInCourt: "Pat" });
    expect(isRfiOverdue(r, NOW)).toBe(true);
    expect(isRfiOverdue({ ...r, respondedAt: "2026-09-20" }, NOW)).toBe(false);
    expect(isRfiOverdue({ ...r, status: "closed" }, NOW)).toBe(false);
    expect(rfi({ ballInCourt: [{ id: "ZZZZZZZZ" }] }).ballInCourt).toBe("Unknown (ZZZZZZ)");
  });

  it("filters by dimension and search", () => {
    const items: RfiRecord[] = [rfi({ id: "a", discipline: "MEP" }), rfi({ id: "b", title: "Roof" })];
    expect(applyGenericFilters(items, rfisConfig, { ...EMPTY_GENERIC_FILTERS, dims: { discipline: ["MEP"] } })).toHaveLength(1);
    expect(applyGenericFilters(items, rfisConfig, { ...EMPTY_GENERIC_FILTERS, dims: { discipline: ["Not set"] } })).toHaveLength(1);
    expect(applyGenericFilters(items, rfisConfig, { ...EMPTY_GENERIC_FILTERS, search: "roof" })).toHaveLength(1);
  });
});

describe("generic dashboards", () => {
  it("render, build a PDF, and survive a snapshot round trip", async () => {
    const ds = { projects: [{ id: "p1", name: "Project One", count: 2 }], items: reviews };
    const html = renderToString(<GenericView cfg={reviewsConfig} dataset={ds} now={NOW} />);
    expect(html).toContain("Stage 4 drawings");
    expect(html).toContain("(overdue)");
    const report = buildGenericReport({ cfg: reviewsConfig, items: reviews, filters: EMPTY_GENERIC_FILTERS, projectNames: {}, now: NOW, includeRegister: true });
    const buf = await renderToBuffer(<DashboardPdf report={report} />);
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(parseGenericDataset(JSON.parse(JSON.stringify(ds))).items).toHaveLength(2);
    expect(() => parseGenericDataset({ projects: [], items: [{ id: 1 }] })).toThrow();
  }, 60_000);
});
