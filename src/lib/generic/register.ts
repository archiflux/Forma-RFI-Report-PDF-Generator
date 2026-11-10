// Register columns for the config-driven dashboards (RFIs, Reviews,
// Submittals): the config's columns as defaults, plus custom fields.

import { customKeys, type RegisterColumn } from "@/lib/layout/register";
import type { RegisterSort } from "@/lib/layout/layout";
import type { BaseRecord, GenericConfig } from "./types";

export function genericColumns<T extends BaseRecord>(cfg: GenericConfig<T>, items: T[], now: Date): Array<RegisterColumn<T>> {
  const cols: Array<RegisterColumn<T>> = cfg.columns.map((c, i) => ({
    id: c.label,
    label: c.label,
    value: (t: T) => c.value(t, now),
    ...(c.sortValue ? { sortValue: c.sortValue } : {}),
    ...(i === 0 ? { href: (t: T) => cfg.linkOf(t) } : {}),
    ...(c.alert ? { alert: (t: T) => Boolean(c.alert?.(t, now)) } : {}),
    width: c.width ?? 1,
    default: true,
  }));
  if (cfg.customOf) {
    const taken = new Set(cols.map((c) => c.id));
    for (const k of customKeys(items.map((t) => cfg.customOf?.(t)))) {
      if (taken.has(k)) continue;
      cols.push({ id: `custom:${k}`, label: k, value: (t) => cfg.customOf?.(t)?.[k] ?? "", width: 1.2 });
    }
  }
  return cols;
}

export function genericDefaultSort<T extends BaseRecord>(cfg: GenericConfig<T>): RegisterSort {
  return { col: cfg.columns[cfg.defaultSort.column]?.label ?? cfg.columns[0]?.label ?? "", dir: cfg.defaultSort.dir };
}
