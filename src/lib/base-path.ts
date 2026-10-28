// Prefix for when the app is served under a sub-path (e.g. /siteboard).
// Next adds basePath to <Link> and router calls itself, but not to raw
// fetch() URLs, <Image> src or metadata icons, so those go through withBase.
export const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");

export function withBase(path: string): string {
  return `${BASE_PATH}${path.startsWith("/") ? path : `/${path}`}`;
}
