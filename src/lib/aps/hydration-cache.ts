// Per-tab persistence of hydrated RFI / Issue datasets.
//
// Hydration walks every RFI's full-detail endpoint and can take several
// minutes on a 600+ RFI project. Once done, navigating /rfis → /builder
// must not lose it, or the user has to do the slow walk again.
//
// Two layers cover this:
//   - In-memory: TanStack Query (gcTime: Infinity on the hydrated query)
//     handles SPA navigation, which keeps the same QueryClient instance.
//   - sessionStorage: a lean snapshot survives a Cmd-R within the same tab.
//
// We persist a lean form (no `comments`, no `extra` bag) because
// sessionStorage caps at ~5 MB per origin in most browsers. A 600-RFI
// payload with full comments easily blows past that and silently fails
// the write — leaving the user thinking the cache is broken. Lean form
// keeps the bits the merge / display path actually needs (custom
// attributes, parties, attachments) and drops the fat ones.
//
// Read-only / privacy: we only ever store data the user just fetched with
// their own bearer token. Nothing leaves the browser. sessionStorage is
// scoped to origin + tab, so a different Forma user signing in on the same
// machine in a new tab never sees this dataset. signOut() in
// lib/auth/store.ts wipes every `forma-rfi:*` key.

import type { Rfi } from "./types";

const SCHEMA_VERSION = 2;

interface CachedPayload {
  v: number;
  rfis: Rfi[];
  storedAt: number;
}

function key(prefix: string, projectId: string): string {
  return `forma-rfi:${prefix}:${projectId}`;
}

function getStorage(): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.sessionStorage;
  } catch {
    // Safari private mode or sandbox blocks access — fail silently.
    return undefined;
  }
}

// Strip the heavy fields that aren't needed to skip the rehydrate prompt
// or render custom-field columns. comments are re-fetched on demand when
// the Detail layout asks for them; extra is a debug bag.
function leanRfi(r: Rfi): Rfi {
  const out: Rfi = { ...r };
  if (out.comments && out.comments.length > 0) out.comments = [];
  if (out.extra && Object.keys(out.extra).length > 0) out.extra = {};
  return out;
}

export function readHydrated(prefix: string, projectId: string): Rfi[] | undefined {
  const storage = getStorage();
  if (!storage || !projectId) return undefined;
  try {
    const raw = storage.getItem(key(prefix, projectId));
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as CachedPayload;
    if (parsed?.v !== SCHEMA_VERSION || !Array.isArray(parsed.rfis)) {
      return undefined;
    }
    return parsed.rfis;
  } catch {
    return undefined;
  }
}

export function writeHydrated(prefix: string, projectId: string, rfis: Rfi[]): void {
  const storage = getStorage();
  if (!storage || !projectId) return;
  const payload: CachedPayload = {
    v: SCHEMA_VERSION,
    rfis: rfis.map(leanRfi),
    storedAt: Date.now(),
  };
  let body: string;
  try {
    body = JSON.stringify(payload);
  } catch {
    return;
  }
  try {
    storage.setItem(key(prefix, projectId), body);
  } catch {
    // QuotaExceededError on enormous projects — best-effort: drop our
    // own previous entries and retry once, then give up. The in-memory
    // TanStack cache (gcTime: Infinity) still has the full dataset for
    // navigation; we just lose Cmd-R survivability.
    try {
      const drop: string[] = [];
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i);
        if (k && k.startsWith("forma-rfi:") && k !== key(prefix, projectId)) {
          drop.push(k);
        }
      }
      for (const k of drop) storage.removeItem(k);
      storage.setItem(key(prefix, projectId), body);
    } catch {
      // Still over quota — give up silently.
    }
  }
}

export function clearHydrated(prefix: string, projectId: string): void {
  const storage = getStorage();
  if (!storage || !projectId) return;
  try {
    storage.removeItem(key(prefix, projectId));
  } catch {
    // ignore
  }
}
