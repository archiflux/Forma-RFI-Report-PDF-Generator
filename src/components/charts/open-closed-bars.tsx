"use client";

export interface OpenClosedRow {
  id: string;
  name: string;
  open: number;
  closed: number;
  overdue: number;
}

// Per-project stacked bar (open, then done) scaled to the largest project,
// with the counts repeated as columns. Click a project name to filter.
export function OpenClosedBars({ rows, onSelect, selected = [] }: { rows: OpenClosedRow[]; onSelect?: (id: string) => void; selected?: string[] }) {
  const max = Math.max(1, ...rows.map((r) => r.open + r.closed));
  if (!rows.length) return <p className="text-sm text-[color:var(--brand-muted)]">No data.</p>;
  return (
    <div>
      <div className="mb-2 flex gap-3 text-xs text-[color:var(--brand-ink-soft)]">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--series-1)" }} />Open</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--series-other)" }} />Closed</span>
      </div>
      <div className="max-h-80 overflow-y-auto pr-1">
        <table className="w-full text-xs">
          <thead className="text-left text-[color:var(--brand-muted)]">
            <tr>
              <th className="py-1 pr-2 font-medium">Project</th>
              <th className="w-[45%] py-1 pr-2 font-medium" />
              <th className="py-1 pr-2 text-right font-medium">Open</th>
              <th className="py-1 pr-2 text-right font-medium">Overdue</th>
              <th className="py-1 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const dim = selected.length > 0 && !selected.includes(r.id);
              return (
                <tr key={r.id} className={`border-t border-[color:var(--brand-border)] ${dim ? "opacity-40" : ""}`}>
                  <td className="max-w-[14rem] truncate py-1.5 pr-2">
                    {onSelect ? (
                      <button type="button" className="truncate text-left hover:underline" title={r.name} onClick={() => onSelect(r.id)}>{r.name}</button>
                    ) : (
                      r.name
                    )}
                  </td>
                  <td className="py-1.5 pr-2">
                    <div className="flex h-3 gap-[2px]" style={{ width: `${((r.open + r.closed) / max) * 100}%` }}>
                      {r.open ? <span style={{ flexGrow: r.open, background: "var(--series-1)" }} className={r.closed ? "" : "rounded-r-[4px]"} /> : null}
                      {r.closed ? <span style={{ flexGrow: r.closed, background: "var(--series-other)" }} className="rounded-r-[4px]" /> : null}
                    </div>
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{r.open}</td>
                  <td className={`py-1.5 pr-2 text-right tabular-nums ${r.overdue ? "font-semibold text-[color:var(--status-critical)]" : ""}`}>{r.overdue}</td>
                  <td className="py-1.5 text-right font-semibold tabular-nums">{r.open + r.closed}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
