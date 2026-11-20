// Fetches the Bailey Partnership logos and converts them to data URIs so
// @react-pdf can embed them without a runtime fetch (which can fail under
// stricter CSPs or when the renderer runs in a worker).
//
// Two variants:
//   - colour: navy/yellow on white — used in page headers (white page)
//   - white: wordmark reversed out for use on the navy cover hero band
//
// Cached for the duration of the page session: the same Blob is reused
// across every PDF export. ~240 KB combined, negligible memory.

const LOGO_COLOUR_PATH = "/logo-colour.png";
const LOGO_WHITE_PATH = "/logo-white.png";

export interface LogoSet {
  colour?: string;
  white?: string;
}

let cached: Promise<LogoSet> | undefined;

export function loadLogos(): Promise<LogoSet> {
  if (cached) return cached;
  if (typeof window === "undefined") {
    cached = Promise.resolve({});
    return cached;
  }
  cached = (async () => {
    const [colour, white] = await Promise.all([
      fetchAsDataUri(LOGO_COLOUR_PATH),
      fetchAsDataUri(LOGO_WHITE_PATH),
    ]);
    return { colour, white };
  })();
  return cached;
}

// Back-compat alias — pdf.tsx still accepts a single `logoDataUri` prop.
export async function loadLogoDataUri(): Promise<string | undefined> {
  const { colour } = await loadLogos();
  return colour;
}

async function fetchAsDataUri(path: string): Promise<string | undefined> {
  try {
    const res = await fetch(path);
    if (!res.ok) return undefined;
    const blob = await res.blob();
    return await blobToDataUri(blob);
  } catch {
    return undefined;
  }
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
