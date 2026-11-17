// UK postcodes in free text (Forma location names such as
// "UK770000010 - 312 Bath Road - SL1 4DX", form names, answers).

// Outward code (SL1, NW5, EC1A, W1T), optional space, inward code (4DX).
// Word boundaries stop matches inside longer codes such as "UK770000010".
const RE = /\b([A-Z]{1,2}[0-9][A-Z0-9]?)\s?([0-9][A-Z]{2})\b/gi;

// The last postcode in the text (addresses end with it), normalised to
// "SL1 4DX". Also accepts a missing space ("SL14DX").
export function findPostcode(text: string | undefined | null): string | undefined {
  if (!text) return undefined;
  let last: string | undefined;
  for (const m of text.matchAll(RE)) last = `${(m[1] as string).toUpperCase()} ${(m[2] as string).toUpperCase()}`;
  return last;
}

export function isPostcode(s: string): boolean {
  return /^[A-Z]{1,2}[0-9][A-Z0-9]? [0-9][A-Z]{2}$/.test(s);
}

export function outwardCode(postcode: string): string {
  return postcode.split(" ")[0] ?? postcode;
}
