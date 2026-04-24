// Server-side APS proxy logic. Used by the Next.js route handler at
// /api/aps/[...path]. Extracted into a pure function so it's unit-testable
// without spinning up a Next runtime.
//
// Why a proxy at all: ACC/Forma RFI v3 endpoints don't send CORS headers,
// so calling them directly from the browser fails with TypeError "Load
// failed" (Safari) / "Failed to fetch" (Chrome). Data Management (hubs,
// projects) does send CORS headers, but we route everything through the
// proxy for consistency.
//
// The proxy is stateless. The user's bearer token is forwarded upstream
// once per request and never persisted or logged.

import { APS_BASE_URL } from "./config";
import { isReadOnlyRequest } from "./client";

export interface ProxyInput {
  method: string;
  // Path AFTER /api/aps — e.g. "/construction/rfis/v3/projects/x/search:rfis".
  path: string;
  query: URLSearchParams;
  authorization: string | null;
  body: string | undefined;
  fetchImpl?: typeof fetch;
}

export async function proxyApsRequest(input: ProxyInput): Promise<Response> {
  const method = input.method.toUpperCase();

  // Same read-only contract the client enforces — duplicated here so a
  // malicious actor who bypasses the client (e.g. curl to /api/aps/...)
  // still can't write. If either side ever drifts, the other catches it.
  if (!isReadOnlyRequest(method, input.path)) {
    return new Response(
      JSON.stringify({ error: "method_not_allowed", message: "This proxy is read-only." }),
      { status: 405, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!input.authorization) {
    return new Response(
      JSON.stringify({ error: "missing_authorization" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  // Strip a leading slash once so we can safely concatenate.
  const cleanPath = input.path.startsWith("/") ? input.path.slice(1) : input.path;
  const upstream = new URL(cleanPath, `${APS_BASE_URL}/`);
  for (const [k, v] of input.query) upstream.searchParams.set(k, v);

  const headers: Record<string, string> = {
    Authorization: input.authorization,
    Accept: "application/json",
  };
  if (input.body !== undefined && input.body !== "") {
    headers["Content-Type"] = "application/json";
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  const res = await fetchImpl(upstream.toString(), {
    method,
    headers,
    body: method === "GET" ? undefined : input.body,
  });

  // Clone the response body. Headers: pass through content-type only so we
  // don't accidentally forward upstream CORS / set-cookie / rate-limit
  // headers that aren't meaningful to our client.
  const responseBody = await res.text();
  return new Response(responseBody, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "application/json",
    },
  });
}
