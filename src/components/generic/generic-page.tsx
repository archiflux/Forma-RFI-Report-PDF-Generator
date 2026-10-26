"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useProjectSelection } from "@/lib/dashboard/use-project-selection";
import { useGenericData, type ProjectLoader } from "@/lib/generic/use-generic-data";
import { useProjectLocations } from "@/lib/dashboard/use-project-locations";
import type { BaseRecord, GenericConfig } from "@/lib/generic/types";
import { SelectionSidebar } from "@/components/dashboard/selection-sidebar";
import { SharePanel } from "@/components/dashboard/share-panel";
import { GenericView } from "./generic-view";

function Notice({ tone, summary, items }: { tone: "error" | "info"; summary: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <details className={`rounded-lg border px-3 py-2 text-xs ${tone === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-[color:var(--brand-border)] bg-white"}`}>
      <summary className="cursor-pointer font-medium">{summary}</summary>
      <ul className="mt-1 list-disc pl-5">{items.map((t) => <li key={t}>{t}</li>)}</ul>
    </details>
  );
}

// `enrich` adds a button that reloads with per-record detail (slower), for
// fields the list endpoint leaves out, such as RFI custom fields.
export function GenericPage<T extends BaseRecord>({
  cfg,
  loader,
  intro,
  enrich,
}: {
  cfg: GenericConfig<T>;
  loader: ProjectLoader<T>;
  intro: string;
  enrich?: { label: string; note: string };
}) {
  const sel = useProjectSelection();
  const { hubId, chosen } = sel;
  const [full, setFull] = useState(false);
  const [progress, setProgress] = useState<Record<string, { done: number; total: number }>>({});
  const onProgress = useCallback(
    (id: string, done: number, total: number) => setProgress((p) => ({ ...p, [id]: { done, total } })),
    [],
  );
  const { dataset, loading, fetching, total } = useGenericData(cfg.kind, loader, chosen, full, onProgress);
  const detail = Object.entries(progress).filter(([id]) => chosen.some((p) => p.id === id));
  const detailDone = detail.reduce((s, [, v]) => s + v.done, 0);
  const detailTotal = detail.reduce((s, [, v]) => s + v.total, 0);
  const locations = useProjectLocations(chosen);
  const now = useMemo(() => new Date(), []);
  const failed = dataset.projects.filter((p) => p.error);
  const skipped = dataset.projects.filter((p) => p.unavailable);

  if (!hubId) return <p className="text-sm">Pick a hub first - <Link href="/hubs" className="underline">choose hub</Link>.</p>;

  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <SelectionSidebar sel={sel} />
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-[color:var(--brand-primary)]">{cfg.title}</h2>
            <p className="text-sm text-[color:var(--brand-muted)]">
              {intro} across {chosen.length || "no"} selected project{chosen.length === 1 ? "" : "s"}.
              {loading ? ` Loading ${total - loading} of ${total}…` : ""}
            </p>
          </div>
          <Link href={`/templates?hubId=${encodeURIComponent(hubId)}`} className="text-sm font-medium text-[color:var(--brand-secondary)] underline-offset-4 hover:underline">
            All templates
          </Link>
        </div>
        {enrich && chosen.length ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[color:var(--brand-border)] bg-white px-3 py-2 text-xs">
            {!full ? (
              <>
                <Button size="sm" variant="secondary" onClick={() => setFull(true)}>
                  {enrich.label}
                </Button>
                <span className="text-[color:var(--brand-muted)]">{enrich.note}</span>
              </>
            ) : fetching ? (
              <span>
                Loading custom fields{detailTotal ? `: ${detailDone} of ${detailTotal}` : "…"}. You can keep using the dashboard meanwhile.
              </span>
            ) : (
              <span>Custom fields loaded. Use &quot;+ Custom field filter&quot; above.</span>
            )}
          </div>
        ) : null}
        <Notice tone="error" summary={`${failed.length} project${failed.length === 1 ? "" : "s"} failed to load`} items={failed.map((p) => `${p.name}: ${p.error}`)} />
        <Notice tone="info" summary={`${skipped.length} project${skipped.length === 1 ? "" : "s"} skipped: this tool isn't switched on`} items={skipped.map((p) => p.name)} />
        {chosen.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[color:var(--brand-border)] p-10 text-center text-sm text-[color:var(--brand-muted)]">
            Tick one or more projects, or load a saved set, to build the dashboard.
          </p>
        ) : (
          <>
            <GenericView cfg={cfg} dataset={dataset} now={now} locations={locations} />
            <SharePanel
              kind={cfg.kind}
              itemCount={dataset.items.length}
              defaultTitle={cfg.title}
              redactionNote={cfg.redactionNote}
              buildData={(redacted) => {
                const clean = { projects: dataset.projects.filter((p) => !p.error && !p.unavailable), items: dataset.items };
                return redacted ? cfg.redact(clean) : clean;
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
