import { describe, expect, it } from "vitest";
import { canUseProbe, probeUsers } from "@/lib/auth/use-can-probe";
import { TEMPLATES } from "@/lib/dashboard/templates";

describe("data probe access", () => {
  it("defaults to Jamie's login only, case-insensitively", () => {
    expect(probeUsers("")).toEqual(["j.henderson@baileyp.co.uk"]);
    expect(canUseProbe("J.Henderson@BaileyP.co.uk", probeUsers(""))).toBe(true);
    expect(canUseProbe("someone@baileyp.co.uk", probeUsers(""))).toBe(false);
    expect(canUseProbe(undefined, probeUsers(""))).toBe(false);
  });

  it("can be overridden", () => {
    expect(canUseProbe("a@x.com", probeUsers("a@x.com; b@x.com"))).toBe(true);
  });
});

describe("template catalogue", () => {
  it("shows the four live dashboards and hides Submittals", () => {
    expect(TEMPLATES.filter((t) => !t.hidden).map((t) => t.id)).toEqual(["issues", "rfi-dashboard", "forms", "reviews"]);
  });
});
