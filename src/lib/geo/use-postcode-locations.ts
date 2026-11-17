"use client";

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { withBase } from "@/lib/base-path";
import type { GeoResult } from "./geocode-handler";

// Postcode -> coordinates, looked up in batches through /api/geocode and
// remembered in this browser (postcode positions don't change), so each
// postcode is only ever looked up once per browser.
const CACHE_KEY = "siteboard:postcode-geo";
const BATCH = 100;

function readCache(): Record<string, GeoResult | null> {
  try {
    return JSON.parse(window.localStorage.getItem(CACHE_KEY) ?? "{}") as Record<string, GeoResult | null>;
  } catch {
    return {};
  }
}

function writeCache(add: Record<string, GeoResult | null>) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify({ ...readCache(), ...add }));
  } catch {
    // Storage full or blocked: lookups just repeat next time.
  }
}

async function lookup(batch: string[]): Promise<Record<string, GeoResult | null>> {
  const res = await fetch(withBase("/api/geocode"), {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-siteboard": "1" },
    body: JSON.stringify({ postcodes: batch }),
  });
  if (!res.ok) throw new Error(`Postcode lookup failed (${res.status})`);
  const { results } = (await res.json()) as { results: Record<string, GeoResult | null> };
  writeCache(results);
  return results;
}

export function usePostcodeLocations(postcodes: string[]): Record<string, GeoResult | null> {
  const wanted = useMemo(() => [...new Set(postcodes)].sort(), [postcodes]);
  const cached = useMemo(() => (typeof window === "undefined" ? {} : readCache()), [wanted]); // eslint-disable-line react-hooks/exhaustive-deps
  const batches = useMemo(() => {
    const todo = wanted.filter((p) => !(p in cached));
    const out: string[][] = [];
    for (let i = 0; i < todo.length; i += BATCH) out.push(todo.slice(i, i + BATCH));
    return out;
  }, [wanted, cached]);
  const results = useQueries({
    queries: batches.map((b) => ({
      queryKey: ["geocode", b.join(",")],
      queryFn: () => lookup(b),
      staleTime: Infinity,
      retry: 1,
    })),
  });
  const key = results.map((r) => r.dataUpdatedAt).join(",");
  return useMemo(() => {
    const out: Record<string, GeoResult | null> = {};
    for (const p of wanted) if (p in cached) out[p] = cached[p] ?? null;
    for (const r of results) Object.assign(out, r.data ?? {});
    return out;
    // results identity changes every render; key captures real updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, wanted, cached]);
}
