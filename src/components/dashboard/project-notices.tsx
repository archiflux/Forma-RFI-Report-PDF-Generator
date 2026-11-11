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

// Projects that failed to load, with a button to try just those again.
export function FailedNotice({ failed, onRetry }: { failed: Array<{ id: string; name: string; error?: string }>; onRetry?: () => void }) {
  if (!failed.length) return null;
  return (
    <details className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
      <summary className="cursor-pointer font-medium">
        {failed.length} project{failed.length === 1 ? "" : "s"} failed to load
        {onRetry ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onRetry();
            }}
            className="ml-3 rounded-md border border-red-300 bg-white px-2 py-0.5 font-semibold text-red-800 hover:bg-red-100"
          >
            Retry failed projects
          </button>
        ) : null}
      </summary>
      <ul className="mt-1 list-disc space-y-0.5 pl-5">
        {failed.map((p) => (
          <li key={p.id}>
            {p.name}: {p.error}
          </li>
        ))}
      </ul>
    </details>
  );
}

// Per-project load outcomes, collapsed so 50+ projects don't push the
// dashboard off screen.
export function ProjectNotices({ projects, onRetry }: { projects: DatasetProject[]; onRetry?: () => void }) {
  const failed = projects.filter((p) => p.error);
  const noIssues = projects.filter((p) => p.issuesUnavailable);
  const noMembers = projects.filter((p) => p.memberCount === 0 && p.issueCount > 0);
  const n = (k: number) => `${k} project${k === 1 ? "" : "s"}`;
  return (
    <div className="space-y-2">
      <FailedNotice failed={failed} {...(onRetry ? { onRetry } : {})} />
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
