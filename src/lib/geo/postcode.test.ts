import { describe, expect, it } from "vitest";
import { findPostcode, isPostcode } from "./postcode";

describe("findPostcode", () => {
  it("finds the postcode in Forma location names", () => {
    expect(findPostcode("UK770000010 - 312 Bath Road - SL1 4DX")).toBe("SL1 4DX");
    expect(findPostcode("UK769900010 - 312A Bath Road - SL14DX")).toBe("SL1 4DX");
    expect(findPostcode("Project > SEGRO Centre Kentish Town > UK752300010 - 306 Spring Place - NW5 3ER")).toBe("NW5 3ER");
    expect(findPostcode("unit 4, w1t 3qn")).toBe("W1T 3QN");
    expect(findPostcode("EC1A 1BB")).toBe("EC1A 1BB");
  });

  it("ignores text with no postcode, including reference numbers", () => {
    expect(findPostcode("UK770000010")).toBeUndefined();
    expect(findPostcode("SEGRO Centre Dagenham")).toBeUndefined();
    expect(findPostcode(undefined)).toBeUndefined();
  });

  it("validates normalised postcodes", () => {
    expect(isPostcode("RM9 6FF")).toBe(true);
    expect(isPostcode("RM96FF")).toBe(false);
  });
});
