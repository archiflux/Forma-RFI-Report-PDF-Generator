import { FormaLink } from "@/components/dashboard/forma-link";

export interface OverdueDisplayRow {
  key: string;
  title: string;
  href?: string;
  project: string;
  number: string;
  owner?: string;
  due: string;
  daysOverdue: number;
}

// "Top 10 most overdue" list: longest overdue first, linking to Forma.
export function OverdueTable({ rows, ownerLabel }: { rows: OverdueDisplayRow[]; ownerLabel: string }) {
  if (!rows.length) return <p className="text-sm text-[color:var(--brand-muted)]">Nothing overdue. Nice.</p>;
  const max = Math.max(...rows.map((r) => r.daysOverdue));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-xs">
        <thead className="text-left text-[color:var(--brand-muted)]">
          <tr>
            <th className="py-1 pr-2 font-medium">Title</th>
            <th className="py-1 pr-2 font-medium">Project</th>
            <th className="py-1 pr-2 font-medium">{ownerLabel}</th>
            <th className="py-1 pr-2 font-medium">Due</th>
            <th className="w-40 py-1 font-medium">Days overdue</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-[color:var(--brand-border)] align-top">
              <td className="max-w-[18rem] py-1.5 pr-2">
                <span className="mr-1 tabular-nums text-[color:var(--brand-muted)]">{r.number}</span>
                {r.href ? <FormaLink href={r.href}>{r.title || "(untitled)"}</FormaLink> : r.title}
              </td>
              <td className="max-w-[12rem] truncate py-1.5 pr-2" title={r.project}>{r.project}</td>
              <td className="py-1.5 pr-2">{r.owner ?? ""}</td>
              <td className="py-1.5 pr-2 tabular-nums">{new Date(r.due).toLocaleDateString("en-GB")}</td>
              <td className="py-1.5">
                <div className="flex items-center gap-2">
                  <span className="h-2 rounded-r-[4px]" style={{ width: `${Math.max(4, (r.daysOverdue / max) * 100)}%`, background: "var(--status-critical)" }} />
                  <span className="font-semibold tabular-nums text-[color:var(--status-critical)]">{r.daysOverdue}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
