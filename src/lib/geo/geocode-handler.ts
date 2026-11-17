// Server side of postcode lookups for the Forms map. Looks UK postcodes up
// on postcodes.io (free, built on Ordnance Survey / ONS open data), and
// falls back to the postcode district (e.g. "SL1") when a full postcode is
// unknown or retired. Only postcodes are sent; no project data.

import { isPostcode, outwardCode } from "./postcode";

export const POSTCODES_API = "https://api.postcodes.io";
const MAX_BATCH = 100;

export type GeoResult = { lat: number; lon: number; approx?: true };

function json(status: number, body: unknown, cache = false): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": cache ? "private, max-age=86400" : "no-store" },
  });
}

function sameOrigin(req: Request): boolean {
  if (req.headers.get("x-siteboard") !== "1") return false;
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(req.url).host;
  } catch {
    return false;
  }
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

export async function geocode(req: Request, fetchImpl: typeof fetch = fetch): Promise<Response> {
  if (!sameOrigin(req)) return json(403, { error: "Forbidden" });
  let body: { postcodes?: unknown };
  try {
    body = (await req.json()) as { postcodes?: unknown };
  } catch {
    return json(400, { error: "Bad request" });
  }
  const list = Array.isArray(body.postcodes) ? [...new Set(body.postcodes.filter((p): p is string => typeof p === "string" && isPostcode(p)))] : [];
  if (!list.length || list.length > MAX_BATCH) return json(400, { error: `Send 1 to ${MAX_BATCH} postcodes.` });

  const results: Record<string, GeoResult | null> = {};
  try {
    const res = await fetchImpl(`${POSTCODES_API}/postcodes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postcodes: list }),
    });
    const data = (await res.json()) as { result?: Array<{ query?: string; result?: { latitude?: unknown; longitude?: unknown } | null }> };
    for (const r of data.result ?? []) {
      const q = String(r.query ?? "").toUpperCase();
      const lat = num(r.result?.latitude);
      const lon = num(r.result?.longitude);
      const key = list.find((p) => p.replace(" ", "") === q.replace(/\s/g, ""));
      if (key) results[key] = lat !== undefined && lon !== undefined ? { lat, lon } : null;
    }
  } catch {
    return json(502, { error: "Postcode lookup unavailable." });
  }

  // District centre for anything not found (new, retired or mistyped).
  const missing = list.filter((p) => !results[p]);
  const districts = [...new Set(missing.map(outwardCode))];
  const centres = new Map<string, GeoResult>();
  await Promise.all(
    districts.slice(0, 20).map(async (d) => {
      try {
        const res = await fetchImpl(`${POSTCODES_API}/outcodes/${encodeURIComponent(d)}`);
        if (!res.ok) return;
        const data = (await res.json()) as { result?: { latitude?: unknown; longitude?: unknown } };
        const lat = num(data.result?.latitude);
        const lon = num(data.result?.longitude);
        if (lat !== undefined && lon !== undefined) centres.set(d, { lat, lon, approx: true });
      } catch {
        // Leave it unmapped.
      }
    }),
  );
  for (const p of missing) results[p] = centres.get(outwardCode(p)) ?? null;
  return json(200, { results }, true);
}
