import { afterEach, describe, expect, it, vi } from "vitest";

describe("withBase", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("leaves paths alone with no base path", async () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "");
    const { withBase } = await import("./base-path");
    expect(withBase("/api/share")).toBe("/api/share");
  });

  it("prefixes the base path", async () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/siteboard/");
    const { withBase } = await import("./base-path");
    expect(withBase("/api/share")).toBe("/siteboard/api/share");
    expect(withBase("icon-colour.png")).toBe("/siteboard/icon-colour.png");
  });
});
