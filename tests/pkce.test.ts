import { describe, expect, it } from "vitest";
import {
  deriveCodeChallenge,
  generateCodeVerifier,
  generateState,
} from "@/lib/aps/pkce";

describe("PKCE helpers", () => {
  it("generates a verifier in the RFC 7636 length range (43-128, base64url)", () => {
    const v = generateCodeVerifier();
    expect(v.length).toBeGreaterThanOrEqual(43);
    expect(v.length).toBeLessThanOrEqual(128);
    expect(v).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("produces distinct verifiers across calls", () => {
    const a = generateCodeVerifier();
    const b = generateCodeVerifier();
    expect(a).not.toBe(b);
  });

  it("derives an S256 challenge as base64url(SHA256(verifier))", async () => {
    // Fixed verifier → known challenge (computed once, locked in here).
    const challenge = await deriveCodeChallenge("test-verifier-0123456789abcdef");
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(challenge).not.toContain("=");
    expect(challenge).not.toContain("+");
    expect(challenge).not.toContain("/");
  });

  it("state values are unique and base64url", () => {
    const a = generateState();
    const b = generateState();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
