import type { DatasetProject } from "@/lib/dashboard/types";

function Notice({ tone, summary, items }: { tone: "error" | "info"; summary: string; items: string[] }) {
  if (!items.length) return null;
  const cls =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-[color:var(--brand-border)] bg-white text-[color:var(--brand-ink-soft)]";
  return (
    <details className={`rounded-lg border px-3 py-2 text-xs ${cls}`}>
      <summary className="cursor-pointer font-medium">{summary}</summary>
      <ul className="mt-1 list-disc space-y-0.5 pl-5">
        {items.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </details>
  );
}

// Per-project load outcomes, collapsed so 50+ projects don't push the
// dashboard off screen.
export function ProjectNotices({ projects }: { projects: DatasetProject[] }) {
  const failed = projects.filter((p) => p.error);
  const noIssues = projects.filter((p) => p.issuesUnavailable);
  const noMembers = projects.filter((p) => p.memberCount === 0 && p.issueCount > 0);
  const n = (k: number) => `${k} project${k === 1 ? "" : "s"}`;
  return (
    <div className="space-y-2">
      <Notice
        tone="error"
        summary={`${n(failed.length)} failed to load`}
        items={failed.map((p) => `${p.name}: ${p.error}`)}
      />
      <Notice
        tone="info"
        summary={`${n(noIssues.length)} skipped: the Issues tool isn't switched on (usually Docs-only, template or archived projects)`}
        items={noIssues.map((p) => p.name)}
      />
      <Notice
        tone="info"
        summary={`${n(noMembers.length)} show "Unknown user": your account can't read their member list`}
        items={noMembers.map((p) => p.name)}
      />
    </div>
  );
}
