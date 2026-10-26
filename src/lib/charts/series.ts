import { gapFill } from "@/lib/dashboard/aggregate";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

// Monthly counts split by category, for stacked area charts. Categories
// beyond the top `limit` fold into "Other" so colours stay distinguishable.
export function monthlyByCategory<T>(
  items: T[],
  dateOf: (t: T) => string | undefined,
  categoryOf: (t: T) => string,
  limit = 5,
): { categories: string[]; rows: Array<{ month: string } & Record<string, number>> } {
  const totals = new Map<string, number>();
  for (const t of items) totals.set(categoryOf(t), (totals.get(categoryOf(t)) ?? 0) + 1);
  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  const keep = ranked.length > limit ? ranked.slice(0, limit - 1) : ranked;
  const categories = ranked.length > limit ? [...keep, "Other"] : keep;
  const byMonth = new Map<string, Record<string, number>>();
  for (const t of items) {
    const m = dateOf(t)?.slice(0, 7) ?? "";
    if (!MONTH_RE.test(m)) continue;
    const c = keep.includes(categoryOf(t)) ? categoryOf(t) : "Other";
    const row = byMonth.get(m) ?? {};
    row[c] = (row[c] ?? 0) + 1;
    byMonth.set(m, row);
  }
  const rows = gapFill([...byMonth.keys()]).map((month) => {
    const r = byMonth.get(month) ?? {};
    return { month, ...Object.fromEntries(categories.map((c) => [c, r[c] ?? 0])) } as { month: string } & Record<string, number>;
  });
  return { categories, rows };
}

export interface OverdueRow<T> {
  item: T;
  due: string;
  daysOverdue: number;
}

// Open records past their due date, most overdue first.
export function topOverdue<T>(
  items: T[],
  isOpen: (t: T) => boolean,
  dueOf: (t: T) => string | undefined,
  now: Date,
  limit = 10,
): Array<OverdueRow<T>> {
  const today = Date.parse(now.toISOString().slice(0, 10));
  return items
    .flatMap((t) => {
      const due = dueOf(t)?.slice(0, 10);
      if (!due || !isOpen(t)) return [];
      const days = Math.floor((today - Date.parse(due)) / 86_400_000);
      return days > 0 ? [{ item: t, due, daysOverdue: days }] : [];
    })
    .sort((a, b) => b.daysOverdue - a.daysOverdue)
    .slice(0, limit);
}

export function averageDays<T>(items: T[], startOf: (t: T) => string | undefined, endOf: (t: T) => string | undefined): number | null {
  let sum = 0;
  let n = 0;
  for (const t of items) {
    const s = Date.parse(startOf(t) ?? "");
    const e = Date.parse(endOf(t) ?? "");
    if (Number.isFinite(s) && Number.isFinite(e) && e >= s) {
      sum += (e - s) / 86_400_000;
      n++;
    }
  }
  return n ? sum / n : null;
}
