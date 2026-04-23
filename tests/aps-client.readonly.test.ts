import { describe, expect, it, vi } from "vitest";
import { ApsClient, isReadOnlyRequest } from "@/lib/aps/client";
import { assertReadOnlyScopes } from "@/lib/aps/config";

describe("read-only contract (SKILL.md §2)", () => {
  describe("isReadOnlyRequest", () => {
    it("allows GET for any path", () => {
      expect(isReadOnlyRequest("GET", "/project/v1/hubs")).toBe(true);
      expect(
        isReadOnlyRequest("GET", "/construction/rfis/v3/projects/abc/rfis/123"),
      ).toBe(true);
    });

    it("allows the documented search:rfis POST (it's a read)", () => {
      expect(
        isReadOnlyRequest(
          "POST",
          "/construction/rfis/v3/projects/abc-123/search:rfis",
        ),
      ).toBe(true);
    });

    it("blocks every other POST", () => {
      expect(
        isReadOnlyRequest("POST", "/construction/rfis/v3/projects/abc/rfis"),
      ).toBe(false);
      expect(
        isReadOnlyRequest(
          "POST",
          "/construction/rfis/v3/projects/abc/rfis/1/responses",
        ),
      ).toBe(false);
      expect(
        isReadOnlyRequest(
          "POST",
          "/construction/rfis/v3/projects/abc/rfis/1/comments",
        ),
      ).toBe(false);
      expect(isReadOnlyRequest("POST", "/project/v1/hubs")).toBe(false);
    });

    it("blocks PUT, PATCH, DELETE", () => {
      for (const m of ["PUT", "PATCH", "DELETE", "put", "patch", "delete"]) {
        expect(isReadOnlyRequest(m, "/construction/rfis/v3/projects/abc/rfis/1")).toBe(
          false,
        );
      }
    });
  });

  describe("ApsClient", () => {
    const fetchImpl = vi.fn();
    const client = new ApsClient({
      getAccessToken: () => "token",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    it("refuses a PATCH even if fetch would succeed", async () => {
      await expect(
        client.request({
          method: "POST" as never, // force past TS to hit the runtime guard
          path: "/construction/rfis/v3/projects/abc/rfis/1",
        }),
      ).rejects.toThrow(/read-only by contract/i);
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it("makes a GET request with Bearer auth", async () => {
      fetchImpl.mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
      await client.request({ path: "/project/v1/hubs" });
      expect(fetchImpl).toHaveBeenCalledOnce();
      const [, init] = fetchImpl.mock.calls[0] ?? [];
      const headers = (init as RequestInit).headers as Record<string, string>;
      expect(headers.Authorization).toBe("Bearer token");
    });

    it("surfaces APS errors as ApsError", async () => {
      fetchImpl.mockResolvedValueOnce(
        new Response(JSON.stringify({ errors: ["bad"] }), { status: 403 }),
      );
      await expect(
        client.request({ path: "/project/v1/hubs" }),
      ).rejects.toMatchObject({ name: "ApsError", status: 403 });
    });
  });

  describe("assertReadOnlyScopes", () => {
    it("accepts documented read scopes", () => {
      expect(() =>
        assertReadOnlyScopes("data:read account:read viewables:read user-profile:read"),
      ).not.toThrow();
    });

    it("rejects any write/create/delete/update scope", () => {
      expect(() => assertReadOnlyScopes("data:read data:write")).toThrow();
      expect(() => assertReadOnlyScopes("data:read bucket:create")).toThrow();
      expect(() => assertReadOnlyScopes("data:read data:delete")).toThrow();
      expect(() => assertReadOnlyScopes("data:read data:update")).toThrow();
    });
  });
});
