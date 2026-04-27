// Per-tab persistence of hydrated RFI / Issue datasets.
//
// Hydration walks every RFI's full-detail endpoint and can take 30+ seconds
// on a large project. Once that's done, navigating /rfis → /builder must
// not lose it, or the user has to do the slow walk again. The TanStack
// Query cache lives in memory and is enough during continuous interaction,
// but it gets garbage-collected after `gcTime` (default 5 min) and is wiped
// by a Cmd-R. sessionStorage keeps the data alive for the tab's lifetime
// without leaking it to other tabs or surviving a quit-and-reopen.
//
// Read-only / privacy: we only ever store data the user just fetched with
// their own bearer token. Nothing leaves the browser. sessionStorage is
// scoped to origin + tab, so a different Forma user signing in on the same
// machine in a new tab never sees this dataset.

import type { Rfi } from "./types";

const SCHEMA_VERSION = 1;

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
  try {
    const payload: CachedPayload = { v: SCHEMA_VERSION, rfis, storedAt: Date.now() };
    storage.setItem(key(prefix, projectId), JSON.stringify(payload));
  } catch {
    // QuotaExceededError on huge projects — drop silently. The in-memory
    // TanStack cache still has it for the rest of the session; we just
    // can't survive a reload. Better than nuking other entries.
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
