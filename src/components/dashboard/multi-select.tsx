"use client";

export function MultiSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const summary = value.length === 0 ? "All" : value.length === 1 ? (options.find((o) => o.value === value[0])?.label ?? value[0]) : `${value.length} selected`;
  return (
    <details className="relative">
      <summary className="flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-lg border border-[color:var(--brand-border)] bg-white px-3 text-xs">
        <span className="text-[color:var(--brand-muted)]">{label}</span>
        <span className="max-w-[10rem] truncate font-semibold text-[color:var(--brand-primary)]">{summary}</span>
      </summary>
      <div className="absolute z-30 mt-1 max-h-72 w-64 overflow-auto rounded-lg border border-[color:var(--brand-border)] bg-white p-2 shadow-card">
        {value.length ? (
          <button type="button" className="mb-1 text-xs text-[color:var(--brand-secondary)] underline" onClick={() => onChange([])}>
            Clear
          </button>
        ) : null}
        {options.map((o) => (
          <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs hover:bg-[color:var(--brand-canvas)]">
            <input
              type="checkbox"
              checked={value.includes(o.value)}
              onChange={(e) =>
                onChange(e.target.checked ? [...value, o.value] : value.filter((v) => v !== o.value))
              }
            />
            <span className="truncate">{o.label}</span>
          </label>
        ))}
      </div>
    </details>
  );
}
