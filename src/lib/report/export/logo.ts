"use client";

// Fetches the Bailey Partnership logo and converts it to a data URI so
// @react-pdf can embed it without making its own runtime fetch (which can
// fail under stricter CSPs or when the renderer runs in a worker).
//
// Cached for the duration of the page session: the same Blob is reused
// across every PDF export. ~100 KB, negligible memory.

const LOGO_PATH = "/logo-colour.png";

let cached: Promise<string | undefined> | undefined;

export function loadLogoDataUri(): Promise<string | undefined> {
  if (cached) return cached;
  if (typeof window === "undefined") {
    cached = Promise.resolve(undefined);
    return cached;
  }
  cached = (async () => {
    try {
      const res = await fetch(LOGO_PATH);
      if (!res.ok) return undefined;
      const blob = await res.blob();
      return await blobToDataUri(blob);
    } catch {
      return undefined;
    }
  })();
  return cached;
}

function blobToDataUri(blob: Blob): Promise<string | undefined> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      resolve(typeof result === "string" ? result : undefined);
    };
    reader.onerror = () => resolve(undefined);
    reader.readAsDataURL(blob);
  });
}
