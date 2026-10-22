"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { downloadBlob, safeFilename } from "@/lib/report/export/download";
import { DEFAULT_SNAPSHOT_OPTIONS, makeSnapshot, type SnapshotOptions } from "@/lib/dashboard/snapshot";
import type { DashboardDataset } from "@/lib/dashboard/types";

// Freezes the current dataset to a redacted JSON file that the public
// /view page can open without an Autodesk account.
export function SnapshotPanel({ dataset }: { dataset: DashboardDataset }) {
  const [o, setO] = useState<SnapshotOptions>(DEFAULT_SNAPSHOT_OPTIONS);
  const [title, setTitle] = useState("");
  const flag = (k: keyof Omit<SnapshotOptions, "title">, label: string) => (
    <label className="flex items-center gap-2 text-xs">
      <input type="checkbox" checked={o[k]} onChange={(e) => setO({ ...o, [k]: e.target.checked })} />
      {label}
    </label>
  );
  return (
    <details className="rounded-2xl border border-[color:var(--brand-border)] bg-white p-4 shadow-card">
      <summary className="cursor-pointer text-sm font-semibold text-[color:var(--brand-primary)]">
        Share a snapshot (for people without Forma access)
      </summary>
      <div className="mt-3 space-y-2">
        <p className="text-xs text-[color:var(--brand-muted)]">
          Downloads the {dataset.issues.length} loaded issues as a file. Anyone can open it at /view without signing in. It does not update itself.
        </p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Snapshot title, e.g. Riverside - October issues"
          className="min-h-8 w-full max-w-md rounded-lg border border-[color:var(--brand-border)] px-2 text-xs"
        />
        {flag("anonymisePeople", "Replace people's names with Person 1, Person 2 (recommended for public sharing)")}
        {flag("includeDescriptions", "Include issue descriptions")}
        {flag("includeCustomFields", "Include custom fields")}
        <Button
          size="sm"
          disabled={!dataset.issues.length}
          onClick={() => {
            const snap = makeSnapshot(dataset, { ...o, ...(title.trim() ? { title: title.trim() } : {}) });
            downloadBlob(
              new Blob([JSON.stringify(snap)], { type: "application/json" }),
              safeFilename(title || "issues-snapshot", "json"),
            );
          }}
        >
          Download snapshot
        </Button>
      </div>
    </details>
  );
}
