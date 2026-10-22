// Saved project sets, per Autodesk user. Stored in localStorage under a key
// that includes the user's Autodesk id so two people sharing a browser don't
// see each other's sets. Sets hold project ids and names only — no issue
// data — so persisting them across sessions is safe.

export interface ProjectSet {
  id: string;
  name: string;
  hubId: string;
  projects: Array<{ id: string; name: string }>;
  updatedAt: string;
}

const PREFIX = "forma-dash:project-sets:";

export function storageKey(userId: string): string {
  return `${PREFIX}${userId}`;
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function isSet(v: unknown): v is ProjectSet {
  if (!v || typeof v !== "object") return false;
  const s = v as ProjectSet;
  return (
    typeof s.id === "string" &&
    typeof s.name === "string" &&
    typeof s.hubId === "string" &&
    Array.isArray(s.projects)
  );
}

export function loadSets(userId: string, store: Storage | null = storage()): ProjectSet[] {
  if (!userId || !store) return [];
  try {
    const raw = store.getItem(storageKey(userId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isSet) : [];
  } catch {
    return [];
  }
}

function persist(userId: string, sets: ProjectSet[], store: Storage | null): void {
  if (!userId || !store) return;
  try {
    store.setItem(storageKey(userId), JSON.stringify(sets));
  } catch {
    // Quota or blocked storage — sets just won't persist.
  }
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `set-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Insert or replace by name (case-insensitive) within the same hub, so
// re-saving "North region" updates it rather than duplicating it.
export function saveSet(
  userId: string,
  input: Omit<ProjectSet, "id" | "updatedAt">,
  store: Storage | null = storage(),
): ProjectSet[] {
  const sets = loadSets(userId, store);
  const existing = sets.find(
    (s) => s.hubId === input.hubId && s.name.toLowerCase() === input.name.trim().toLowerCase(),
  );
  const next: ProjectSet = {
    ...input,
    name: input.name.trim(),
    id: existing?.id ?? newId(),
    updatedAt: new Date().toISOString(),
  };
  const out = existing ? sets.map((s) => (s.id === existing.id ? next : s)) : [...sets, next];
  persist(userId, out, store);
  return out;
}

export function deleteSet(userId: string, id: string, store: Storage | null = storage()): ProjectSet[] {
  const out = loadSets(userId, store).filter((s) => s.id !== id);
  persist(userId, out, store);
  return out;
}
