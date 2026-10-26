"use client";

// From/to date pair (YYYY-MM-DD) used by every dashboard's filter row.
export function DateRangeFilter({
  label,
  from,
  to,
  onChange,
}: {
  label: string;
  from?: string;
  to?: string;
  onChange: (next: { from?: string; to?: string }) => void;
}) {
  return (
    <label className="flex min-h-9 items-center gap-1 rounded-lg border border-[color:var(--brand-border)] bg-white px-2 text-xs">
      <span className="text-[color:var(--brand-muted)]">{label}</span>
      <input type="date" value={from ?? ""} onChange={(e) => onChange({ from: e.target.value || undefined, to })} className="text-xs" />
      <span>to</span>
      <input type="date" value={to ?? ""} onChange={(e) => onChange({ from, to: e.target.value || undefined })} className="text-xs" />
    </label>
  );
}
