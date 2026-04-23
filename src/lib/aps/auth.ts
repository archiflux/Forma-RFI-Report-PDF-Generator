import { APS_OAUTH, assertReadOnlyScopes, loadPublicConfig } from "./config";
import { deriveCodeChallenge, generateCodeVerifier, generateState } from "./pkce";

const SS_VERIFIER = "aps.pkce.verifier";
const SS_STATE = "aps.pkce.state";
const SS_RETURN_TO = "aps.pkce.returnTo";
const SS_REFRESH = "aps.refreshToken";

export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // epoch ms
  tokenType: string;
  scope: string;
}

export async function beginSignIn(returnTo = "/hubs"): Promise<void> {
  const cfg = loadPublicConfig();
  if (!cfg.clientId) {
    throw new Error("NEXT_PUBLIC_APS_CLIENT_ID is not set. See .env.example.");
  }
  assertReadOnlyScopes(cfg.scopes);

  const verifier = generateCodeVerifier();
  const challenge = await deriveCodeChallenge(verifier);
  const state = generateState();

  sessionStorage.setItem(SS_VERIFIER, verifier);
  sessionStorage.setItem(SS_STATE, state);
  sessionStorage.setItem(SS_RETURN_TO, returnTo);

  const url = new URL(APS_OAUTH.authorizeUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", cfg.clientId);
  url.searchParams.set("redirect_uri", cfg.redirectUri);
  url.searchParams.set("scope", cfg.scopes);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "login");

  window.location.assign(url.toString());
}

export async function completeSignIn(params: URLSearchParams): Promise<TokenSet> {
  const cfg = loadPublicConfig();
  const code = params.get("code");
  const returnedState = params.get("state");
  const error = params.get("error");

  if (error) {
    throw new Error(`Autodesk declined sign-in: ${error} — ${params.get("error_description") ?? ""}`);
  }
  if (!code || !returnedState) {
    throw new Error("Missing code or state in OAuth callback.");
  }

  const expectedState = sessionStorage.getItem(SS_STATE);
  const verifier = sessionStorage.getItem(SS_VERIFIER);
  sessionStorage.removeItem(SS_STATE);
  sessionStorage.removeItem(SS_VERIFIER);

  if (!expectedState || expectedState !== returnedState) {
    throw new Error("OAuth state mismatch — possible CSRF. Please sign in again.");
  }
  if (!verifier) {
    throw new Error("Missing PKCE verifier — sign-in session expired. Please sign in again.");
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    code_verifier: verifier,
    redirect_uri: cfg.redirectUri,
    client_id: cfg.clientId,
  });

  const res = await fetch(APS_OAUTH.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Token exchange failed: ${res.status} ${res.statusText} ${text}`);
  }

  const json = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
    scope: string;
  };

  const tokens: TokenSet = {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + json.expires_in * 1000,
    tokenType: json.token_type,
    scope: json.scope,
  };

  if (tokens.refreshToken) {
    sessionStorage.setItem(SS_REFRESH, tokens.refreshToken);
  }
  return tokens;
}

export async function refreshTokens(): Promise<TokenSet | null> {
  const cfg = loadPublicConfig();
  const refreshToken = sessionStorage.getItem(SS_REFRESH);
  if (!refreshToken) return null;

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: cfg.clientId,
    scope: cfg.scopes,
  });

  const res = await fetch(APS_OAUTH.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  });

  if (!res.ok) {
    sessionStorage.removeItem(SS_REFRESH);
    return null;
  }

  const json = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
    scope: string;
  };

  if (json.refresh_token) sessionStorage.setItem(SS_REFRESH, json.refresh_token);

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? refreshToken,
    expiresAt: Date.now() + json.expires_in * 1000,
    tokenType: json.token_type,
    scope: json.scope,
  };
}

export async function signOut(accessToken: string | null): Promise<void> {
  const cfg = loadPublicConfig();
  const refreshToken = sessionStorage.getItem(SS_REFRESH);
  sessionStorage.removeItem(SS_REFRESH);
  sessionStorage.removeItem(SS_RETURN_TO);

  const revokeIfPresent = async (token: string | null, hint: "access_token" | "refresh_token") => {
    if (!token) return;
    const body = new URLSearchParams({ token, token_type_hint: hint, client_id: cfg.clientId });
    try {
      await fetch(APS_OAUTH.revokeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
    } catch {
      // best-effort — a failed revoke shouldn't block sign-out
    }
  };

  await Promise.all([
    revokeIfPresent(accessToken, "access_token"),
    revokeIfPresent(refreshToken, "refresh_token"),
  ]);
}

export function consumeReturnTo(): string {
  const v = sessionStorage.getItem(SS_RETURN_TO) ?? "/hubs";
  sessionStorage.removeItem(SS_RETURN_TO);
  return v;
}
