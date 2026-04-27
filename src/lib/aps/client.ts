import { APS_BROWSER_BASE } from "./config";
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
  // Override the sleep used by the 429 retry loop. Tests inject a synchronous
  // resolver so they don't have to wait wall-clock time.
  sleepImpl?: (ms: number) => Promise<void>;
  // Max retries for 429 / transient 5xx responses. Default 5 — APS returns
  // 429 in bursts when scraping a large project; an exponential backoff
  // capped at ~30s is enough to clear typical bucket windows.
  maxRetries?: number;
}

export interface ApsRequestInit {
  method?: HttpMethod;
  path: string;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  signal?: AbortSignal;
}

const DEFAULT_MAX_RETRIES = 5;
const RETRY_BASE_MS = 500;
const RETRY_CAP_MS = 30_000;

// Parse Retry-After: either a delta-seconds integer or an HTTP-date.
function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const trimmed = header.trim();
  if (!trimmed) return undefined;
  const seconds = Number(trimmed);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(trimmed);
  if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  return undefined;
}

function backoffDelay(attempt: number): number {
  const exp = Math.min(RETRY_CAP_MS, RETRY_BASE_MS * 2 ** attempt);
  // Full jitter — spreads concurrent retries instead of having every worker
  // hammer APS at the same instant the bucket reopens.
  return Math.floor(Math.random() * exp);
}

function buildUrl(baseUrl: string, path: string, query?: ApsRequestInit["query"]): string {
  const isAbsolute = /^https?:/i.test(baseUrl);
  if (isAbsolute) {
    const url = new URL(path, baseUrl);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined) continue;
        url.searchParams.set(k, String(v));
      }
    }
    return url.toString();
  }
  // Relative base (e.g. "/api/aps") — keep the URL relative so fetch picks
  // the browser's own origin and works in both dev and Vercel preview deploys.
  const trimmedBase = baseUrl.replace(/\/$/, "");
  const joinedPath = path.startsWith("/") ? path : `/${path}`;
  let full = `${trimmedBase}${joinedPath}`;
  if (query) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined) continue;
      qs.set(k, String(v));
    }
    const qstr = qs.toString();
    if (qstr) full += `?${qstr}`;
  }
  return full;
}

export class ApsClient {
  private readonly baseUrl: string;
  private readonly getAccessToken: () => string | null;
  private readonly fetchImpl: typeof fetch;
  private readonly sleepImpl: (ms: number) => Promise<void>;
  private readonly maxRetries: number;

  constructor(opts: ApsClientOptions) {
    this.baseUrl = opts.baseUrl ?? APS_BROWSER_BASE;
    this.getAccessToken = opts.getAccessToken;
    // Bind to globalThis so Safari/WebKit doesn't throw
    // "Can only call Window.fetch on instances of Window" when we call
    // this.fetchImpl(...) — invoking via a method reference sets `this`
    // to the ApsClient instance, which WebKit's receiver check rejects.
    this.fetchImpl = opts.fetchImpl ?? fetch.bind(globalThis);
    this.sleepImpl =
      opts.sleepImpl ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;
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

    // APS rate-limits scrapes of large projects with 429 + Retry-After. The
    // hydration loop also runs 8 workers concurrently which compounds the
    // burst. Retry transient failures (429 and 5xx except 501) with
    // exponential backoff + jitter, honouring Retry-After when present.
    for (let attempt = 0; ; attempt++) {
      let res: Response;
      try {
        res = await this.fetchImpl(url, {
          method,
          headers,
          body: init.body === undefined ? undefined : JSON.stringify(init.body),
          signal: init.signal,
        });
      } catch (e) {
        // DOMException AbortError propagates — caller opted into cancellation.
        if ((e as { name?: string })?.name === "AbortError") throw e;
        // Everything else caught here is a network/CORS TypeError thrown before
        // a response arrived. Safari says "Load failed", Chromium says
        // "Failed to fetch" — neither helps the user. Surface something actionable.
        const reason = e instanceof Error ? e.message : String(e);
        throw new ApsError(
          `Network error calling ${method} ${init.path}: ${reason}. ` +
            `If this is a Forma RFI endpoint, the CORS proxy at ${APS_BROWSER_BASE} ` +
            `may be unreachable — check that the app was deployed to a host that ` +
            `runs Next.js route handlers (Vercel / Cloudflare Pages Functions), ` +
            `not a pure-static host.`,
          0,
        );
      }

      if (res.ok) {
        if (res.status === 204) return undefined as T;
        return (await res.json()) as T;
      }

      const retryable =
        res.status === 429 ||
        res.status === 502 ||
        res.status === 503 ||
        res.status === 504;
      if (retryable && attempt < this.maxRetries) {
        const retryAfterMs = parseRetryAfter(res.headers.get("retry-after"));
        const delay = retryAfterMs ?? backoffDelay(attempt);
        // Drain the body so the connection can be reused.
        try {
          await res.text();
        } catch {
          // ignore
        }
        await this.sleepImpl(delay);
        if (init.signal?.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }
        continue;
      }

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
      const friendlyPrefix =
        res.status === 429
          ? `APS rate-limited ${method} ${init.path} after ${attempt + 1} attempts`
          : `APS ${method} ${init.path} failed`;
      throw new ApsError(
        `${friendlyPrefix}: ${res.status} ${res.statusText}`,
        res.status,
        parsed,
      );
    }
  }
}
