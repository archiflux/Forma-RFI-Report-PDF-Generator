import { describe, expect, it } from "vitest";
import type { FormRecord } from "@/lib/forms/types";
import { formsUniverse } from "./things";

function form(i: number, custom: Record<string, string>): FormRecord {
  return {
    key: `k${i}`, id: `f${i}`, projectId: "p1", projectName: "Park", formNum: String(i), name: `Form ${i}`,
    status: "submitted", templateId: "t", templateName: "Survey", templateType: "checklist",
    createdAt: "2026-11-01T00:00:00Z", location: "Site > Unit 1", custom,
  };
}

describe("formsUniverse", () => {
  it("offers every custom field and the register's groupable fields as Organise by options", () => {
    const answers = Object.fromEntries(Array.from({ length: 15 }, (_, n) => [`Question ${n + 1}`, "Yes"]));
    const u = formsUniverse([form(1, answers), form(2, { "Question 1": "No" })], new Date("2026-11-18"), undefined);
    const labels = u.dims.map((d) => d.label);
    for (let n = 1; n <= 15; n++) expect(labels).toContain(`Question ${n}`);
    expect(labels).toEqual(expect.arrayContaining(["Location", "Template type"]));
    expect(u.things[0]?.groups.location).toBe("Site > Unit 1");
    expect(u.things[1]?.groups["custom:Question 2"]).toBe("Not set");
  });
});
