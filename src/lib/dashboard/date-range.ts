// True when an ISO date falls within an optional YYYY-MM-DD range.
export function inDateRange(iso: string | undefined, from?: string, to?: string): boolean {
  if (!from && !to) return true;
  const d = iso?.slice(0, 10);
  if (!d) return false;
  return (!from || d >= from) && (!to || d <= to);
}
