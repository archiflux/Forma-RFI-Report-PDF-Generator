import { describe, expect, it } from "vitest";
import { classifyHub } from "@/lib/aps/hubs";

describe("classifyHub", () => {
  it("identifies ACC / Forma business hubs", () => {
    expect(classifyHub("hubs:autodesk.bim360:Account")).toBe("acc");
  });

  it("identifies personal / Fusion hubs", () => {
    expect(classifyHub("hubs:autodesk.core:Hub")).toBe("personal");
    expect(classifyHub("hubs:autodesk.a360:PersonalHub")).toBe("personal");
  });

  it("is case-insensitive", () => {
    expect(classifyHub("HUBS:AUTODESK.BIM360:ACCOUNT")).toBe("acc");
    expect(classifyHub("Hubs:Autodesk.Core:Hub")).toBe("personal");
  });

  it("returns 'unknown' for missing or unrecognised types", () => {
    expect(classifyHub(undefined)).toBe("unknown");
    expect(classifyHub("")).toBe("unknown");
    expect(classifyHub("hubs:some.new:Thing")).toBe("unknown");
  });
});
