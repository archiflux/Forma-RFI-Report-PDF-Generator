// The ticked projects live in the web address so a dashboard survives a
// reload. A short list goes in directly (?p=id1,id2). A long one (say "all
// shown" on a big hub) would exceed the host's address limit (Vercel answers
// URI_TOO_LONG), so it's kept in this browser's storage and the address
// carries a short key instead (?sel=key).

export const MAX_INLINE = 1500; // characters of ids before switching to a key
const STORE_KEY = "siteboard:selections";
const KEEP = 20; // most recent long selections remembered

type Saved = Record<string, { ids: string[]; at: number }>;

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function read(store: Storage | null): Saved {
  try {
    const v: unknown = JSON.parse(store?.getItem(STORE_KEY) ?? "{}");
    return v && typeof v === "object" ? (v as Saved) : {};
  } catch {
    return {};
  }
}

// Same selection, same key: stable across reloads and back/forward.
export function selectionKey(ids: string[]): string {
  let h = 2166136261;
  for (const ch of [...ids].sort().join(",")) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return `${(h >>> 0).toString(36)}${ids.length.toString(36)}`;
}

// Writes the selection into `params`, using a stored key when it's long.
export function writeSelection(params: URLSearchParams, ids: string[], store: Storage | null = storage()): void {
  params.delete("p");
  params.delete("sel");
  if (!ids.length) return;
  const joined = ids.join(",");
  if (joined.length <= MAX_INLINE || !store) {
    params.set("p", joined);
    return;
  }
  const key = selectionKey(ids);
  const saved = read(store);
  saved[key] = { ids, at: Date.now() };
  const trimmed = Object.fromEntries(
    Object.entries(saved)
      .sort((a, b) => b[1].at - a[1].at)
      .slice(0, KEEP),
  );
  try {
    store.setItem(STORE_KEY, JSON.stringify(trimmed));
    params.set("sel", key);
  } catch {
    // Storage full or blocked: fall back to the address and hope it fits.
    params.set("p", joined);
  }
}

export function readSelection(params: { get(name: string): string | null }, store: Storage | null = storage()): string[] {
  const p = params.get("p");
  if (p) return p.split(",").filter(Boolean);
  const key = params.get("sel");
  if (!key) return [];
  const ids = read(store)[key]?.ids;
  return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string") : [];
}
