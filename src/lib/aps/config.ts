export const APS_BASE_URL = "https://developer.api.autodesk.com";

// Same-origin proxy that forwards to APS_BASE_URL. The ApsClient hits this
// from the browser to sidestep CORS on the RFI v3 endpoints. The proxy
// enforces the same read-only verb allow-list server-side (see
// src/lib/aps/proxy.ts and src/app/api/aps/[...path]/route.ts).
export const APS_BROWSER_BASE = "/api/aps";

export const APS_OAUTH = {
  authorizeUrl: `${APS_BASE_URL}/authentication/v2/authorize`,
  tokenUrl: `${APS_BASE_URL}/authentication/v2/token`,
  revokeUrl: `${APS_BASE_URL}/authentication/v2/revoke`,
} as const;

// APS gates several admin-shaped GET endpoints behind write-class scopes.
// Most notably, GET /construction/rfis/v3/projects/:p/attributes — the
// custom-field SCHEMA endpoint that gives us human-readable titles — requires
// `data:read data:write data:create` per the official Postman collection.
// Even when the signed-in user is a project admin, omitting those scopes
// returns 403.
//
// We still operate read-only at the REQUEST layer:
//   1. ApsClient enforces a verb allow-list (GET, plus the documented
//      POST .../search:rfis read-shaped query). See src/lib/aps/client.ts.
//   2. The /api/aps proxy enforces the same allow-list server-side. See
//      src/lib/aps/proxy.ts.
//   3. CI test (tests/aps-client.readonly.test.ts) fails any PR that
//      relaxes the verb allow-list.
//
// The token having write capability and the code never USING it is the same
// principle that lets a read-only file viewer run as a user who happens to
// have write permission on the filesystem. If you'd rather strip the
// write/create scopes, set NEXT_PUBLIC_APS_SCOPES in .env.local and accept
// that custom-field titles will fall back to raw IDs.
export const APS_SCOPES_READ_ONLY = [
  "data:read",
  "data:write",
  "data:create",
  "account:read",
  "viewables:read",
  "user-profile:read",
] as const;

export interface ApsPublicConfig {
  clientId: string;
  redirectUri: string;
  scopes: string;
}

export function loadPublicConfig(): ApsPublicConfig {
  const clientId = process.env.NEXT_PUBLIC_APS_CLIENT_ID ?? "";
  const redirectUri =
    process.env.NEXT_PUBLIC_APS_REDIRECT_URI ??
    (typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : "");
  const scopes =
    process.env.NEXT_PUBLIC_APS_SCOPES ?? APS_SCOPES_READ_ONLY.join(" ");
  return { clientId, redirectUri, scopes };
}

// Scopes that would let the token authorise destructive operations the
// app never performs. Kept as an explicit reject list rather than an
// allow list so additions to APS's scope vocabulary don't silently
// inflate what we request.
const FORBIDDEN_SCOPE_FRAGMENTS = ["delete", "destroy"] as const;

export function assertReadOnlyScopes(scopes: string): void {
  const parts = scopes.split(/\s+/).filter(Boolean);
  for (const s of parts) {
    for (const f of FORBIDDEN_SCOPE_FRAGMENTS) {
      if (s.toLowerCase().includes(f)) {
        throw new Error(
          `Refusing to request scope "${s}" — this app never deletes anything.`,
        );
      }
    }
  }
}
