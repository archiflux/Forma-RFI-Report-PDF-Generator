import { APS_BASE_URL } from "./config";
import { ApsError } from "./types";

export type HttpMethod = "GET" | "POST";

// SEARCH endpoints are POST-shaped reads per APS design (RFI v3 has no GET collection).
// Any POST path not in this allow-list is a write and will be blocked.
const READ_SHAPED_POST_ALLOWLIST: readonly RegExp[] = [
  /^\/construction\/rfis\/v3\/projects\/[^/]+\/search:rfis$/,
];

export function isReadOnlyRequest(method: string, path: string): boolean {
  const m = method.toUpperCase();
  if (m === "GET") return true;
  if (m !== "POST") return false;
  return READ_SHAPED_POST_ALLOWLIST.some((re) => re.test(path));
}

export interface ApsClientOptions {
  getAccessToken: () => string | null;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export interface ApsRequestInit {
  method?: HttpMethod;
  path: string;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  signal?: AbortSignal;
}

function buildUrl(baseUrl: string, path: string, query?: ApsRequestInit["query"]): string {
  const url = new URL(path, baseUrl);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined) continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

export class ApsClient {
  private readonly baseUrl: string;
  private readonly getAccessToken: () => string | null;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: ApsClientOptions) {
    this.baseUrl = opts.baseUrl ?? APS_BASE_URL;
    this.getAccessToken = opts.getAccessToken;
    // Bind to globalThis so Safari/WebKit doesn't throw
    // "Can only call Window.fetch on instances of Window" when we call
    // this.fetchImpl(...) — invoking via a method reference sets `this`
    // to the ApsClient instance, which WebKit's receiver check rejects.
    this.fetchImpl = opts.fetchImpl ?? fetch.bind(globalThis);
  }

  async request<T>(init: ApsRequestInit): Promise<T> {
    const method: HttpMethod = init.method ?? "GET";

    if (!isReadOnlyRequest(method, init.path)) {
      throw new Error(
        `ApsClient refused ${method} ${init.path}: this app is read-only by contract. ` +
          "Allowed verbs are GET and POST /construction/rfis/v3/projects/:id/search:rfis. " +
          "See .claude/skills/forma-rfi-report/SKILL.md §2.",
      );
    }

    const token = this.getAccessToken();
    if (!token) {
      throw new ApsError("Not authenticated: no access token available.", 401);
    }

    const url = buildUrl(this.baseUrl, init.path, init.query);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    };
    if (init.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const res = await this.fetchImpl(url, {
      method,
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: init.signal,
    });

    if (!res.ok) {
      let bodyText: string | undefined;
      try {
        bodyText = await res.text();
      } catch {
        // ignore
      }
      let parsed: unknown = bodyText;
      if (bodyText) {
        try {
          parsed = JSON.parse(bodyText);
        } catch {
          // ignore
        }
      }
      throw new ApsError(
        `APS ${method} ${init.path} failed: ${res.status} ${res.statusText}`,
        res.status,
        parsed,
      );
    }

    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }
}
