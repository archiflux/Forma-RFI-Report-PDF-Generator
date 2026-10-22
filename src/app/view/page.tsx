"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { demoDataset } from "@/lib/dashboard/demo";
import { parseSnapshot } from "@/lib/dashboard/snapshot";
import type { DashboardDataset } from "@/lib/dashboard/types";

// Public snapshot viewer. No sign-in and no network calls: the dataset comes
// from a file the viewer opens, or from the built-in demo.
export default function ViewPage() {
  const [ds, setDs] = useState<DashboardDataset | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const now = useMemo(() => (ds ? new Date(ds.generatedAt) : new Date()), [ds]);

  async function open(file: File) {
    setErr(null);
    try {
      setDs(parseSnapshot(JSON.parse(await file.text())));
    } catch {
      setErr("That file is not a valid issues snapshot.");
    }
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-[color:var(--brand-border)] bg-white">
        <div className="mx-auto flex max-w-screen-2xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-10">
          <Image src="/icon-colour.png" alt="Bailey Partnership" width={32} height={32} className="h-8 w-8 rounded-md object-contain" />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--brand-secondary)]">Bailey Partnership</p>
            <h1 className="text-base font-semibold text-[color:var(--brand-primary)]">{ds?.title ?? "Issues dashboard"}</h1>
          </div>
          {ds ? (
            <p className="ml-auto text-xs text-[color:var(--brand-muted)]">
              Snapshot taken {new Date(ds.generatedAt).toLocaleString("en-GB")}
            </p>
          ) : null}
        </div>
      </header>
      <main className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-10">
        {ds ? (
          <DashboardView dataset={ds} now={now} />
        ) : (
          <div className="mx-auto max-w-lg rounded-2xl border border-[color:var(--brand-border)] bg-white p-8 text-center shadow-card">
            <p className="text-sm">Open an issues snapshot file shared with you.</p>
            <label className="mt-4 inline-flex cursor-pointer rounded-lg bg-[color:var(--brand-primary)] px-4 py-2 text-sm font-medium text-white">
              Choose file
              <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => e.target.files?.[0] && open(e.target.files[0])} />
            </label>
            <p className="mt-3 text-xs">
              <button type="button" className="text-[color:var(--brand-secondary)] underline" onClick={() => setDs(demoDataset())}>
                Or explore demo data
              </button>
            </p>
            {err ? <p className="mt-3 text-xs text-red-600">{err}</p> : null}
          </div>
        )}
      </main>
    </div>
  );
}
