export const APS_BASE_URL = "https://developer.api.autodesk.com";

export const APS_OAUTH = {
  authorizeUrl: `${APS_BASE_URL}/authentication/v2/authorize`,
  tokenUrl: `${APS_BASE_URL}/authentication/v2/token`,
  revokeUrl: `${APS_BASE_URL}/authentication/v2/revoke`,
} as const;

export const APS_SCOPES_READ_ONLY = [
  "data:read",
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

const FORBIDDEN_SCOPE_FRAGMENTS = ["write", "create", "delete", "update"] as const;

export function assertReadOnlyScopes(scopes: string): void {
  const parts = scopes.split(/\s+/).filter(Boolean);
  for (const s of parts) {
    for (const f of FORBIDDEN_SCOPE_FRAGMENTS) {
      if (s.toLowerCase().includes(f)) {
        throw new Error(
          `Refusing to request non-read-only scope "${s}". This app is read-only by contract (SKILL.md §2).`,
        );
      }
    }
  }
}
