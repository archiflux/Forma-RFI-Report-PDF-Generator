import { describe, expect, it } from "vitest";
import { formUrl, issueUrl, reviewUrl, rfiUrl } from "@/lib/aps/links";

// Expected values are real addresses copied from the Forma web UI.
describe("Forma deep links", () => {
  const p = "f0390252-9801-4d39-8e56-064c0d7950ca";

  it("issue", () => {
    expect(issueUrl(`b.${p}`, "1eeb8f61-3b56-40cc-af60-5a8ae25ac9e1")).toBe(
      "https://acc.autodesk.com/build/issues/projects/f0390252-9801-4d39-8e56-064c0d7950ca/issues/1eeb8f61-3b56-40cc-af60-5a8ae25ac9e1",
    );
  });

  it("RFI", () => {
    expect(rfiUrl(p, "ac33b8c9-bc44-4cd9-883e-33f810b40f5e")).toBe(
      "https://acc.autodesk.com/build/rfis/projects/f0390252-9801-4d39-8e56-064c0d7950ca?preview=ac33b8c9-bc44-4cd9-883e-33f810b40f5e",
    );
  });

  it("form", () => {
    expect(formUrl(p, "adce6691-6961-4e50-b161-79c1ba655350", "629ab8b5-cc36-47fd-8abe-28fd99ab4b48")).toBe(
      "https://acc.autodesk.com/build/forms/projects/f0390252-9801-4d39-8e56-064c0d7950ca/field-reports/adce6691-6961-4e50-b161-79c1ba655350/reports/629ab8b5-cc36-47fd-8abe-28fd99ab4b48",
    );
  });

  it("review", () => {
    expect(reviewUrl("b.c5df42bd-e8e3-4085-a1cb-9fcf213c078a", "674d63ee-d797-4b8f-a7c8-47d506d2dbf3")).toBe(
      "https://acc.autodesk.com/docs/reviews/projects/c5df42bd-e8e3-4085-a1cb-9fcf213c078a/674d63ee-d797-4b8f-a7c8-47d506d2dbf3",
    );
  });
});
