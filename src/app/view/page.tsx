"use client";

import Image from "next/image";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { FormsView } from "@/components/forms/forms-view";
import { demoDataset } from "@/lib/dashboard/demo";
import { parseSnapshot } from "@/lib/dashboard/snapshot";
import { parseFormsDataset } from "@/lib/forms/snapshot";
import { loadShared } from "@/lib/share/client";
import type { DashboardDataset } from "@/lib/dashboard/types";
import type { FormsDataset } from "@/lib/forms/types";

type Loaded =
  | { kind: "issues"; title: string; takenAt: string; expiresAt?: string; data: DashboardDataset }
  | { kind: "forms"; title: string; takenAt: string; expiresAt?: string; data: FormsDataset };

// Public viewer. No Autodesk sign-in: data comes from a hosted link
// (?s=<id>), a snapshot file the viewer opens, or the built-in demo.
function Viewer() {
  const sharedId = useSearchParams().get("s");
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(sharedId));
  const now = useMemo(() => (loaded ? new Date(loaded.takenAt) : new Date()), [loaded]);

  useEffect(() => {
    if (!sharedId) return;
    loadShared(sharedId)
      .then((snap) => {
        const base = { title: snap.title, takenAt: snap.createdAt, expiresAt: snap.expiresAt };
        if (snap.kind === "issues") setLoaded({ kind: "issues", ...base, data: parseSnapshot(snap.data) });
        else if (snap.kind === "forms") setLoaded({ kind: "forms", ...base, data: parseFormsDataset(snap.data) });
        else setErr("This link is for a dashboard this viewer doesn't support yet.");
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [sharedId]);

  async function openFile(file: File) {
    setErr(null);
    try {
      const ds = parseSnapshot(JSON.parse(await file.text()));
      setLoaded({ kind: "issues", title: ds.title ?? "Issues dashboard", takenAt: ds.generatedAt, data: ds });
    } catch {
      setErr("That file is not a valid issues snapshot.");
    }
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-[color:var(--brand-border)] bg-white">
        <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-10">
          <Image src="/icon-colour.png" alt="Bailey Partnership" width={32} height={32} className="h-8 w-8 rounded-md object-contain" />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--brand-secondary)]">Bailey Partnership</p>
            <h1 className="text-base font-semibold text-[color:var(--brand-primary)]">{loaded?.title ?? "Shared dashboard"}</h1>
          </div>
          {loaded ? (
            <p className="ml-auto text-xs text-[color:var(--brand-muted)]">
              Data as of {new Date(loaded.takenAt).toLocaleString("en-GB")}
              {loaded.expiresAt ? `. Link expires ${new Date(loaded.expiresAt).toLocaleDateString("en-GB")}` : ""}
            </p>
          ) : null}
        </div>
      </header>
      <main className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-10">
        {loaded?.kind === "issues" ? (
          <DashboardView dataset={loaded.data} now={now} />
        ) : loaded?.kind === "forms" ? (
          <FormsView dataset={loaded.data} now={now} />
        ) : loading ? (
          <p className="text-sm text-[color:var(--brand-muted)]">Loading shared dashboard…</p>
        ) : (
          <div className="mx-auto max-w-lg rounded-2xl border border-[color:var(--brand-border)] bg-white p-8 text-center shadow-card">
            {err ? <p className="mb-4 text-sm text-red-600">{err}</p> : null}
            <p className="text-sm">Open an issues snapshot file shared with you.</p>
            <label className="mt-4 inline-flex cursor-pointer rounded-lg bg-[color:var(--brand-primary)] px-4 py-2 text-sm font-medium text-white">
              Choose file
              <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => e.target.files?.[0] && openFile(e.target.files[0])} />
            </label>
            <p className="mt-3 text-xs">
              <button
                type="button"
                className="text-[color:var(--brand-secondary)] underline"
                onClick={() => {
                  const ds = demoDataset();
                  setLoaded({ kind: "issues", title: "Demo data", takenAt: ds.generatedAt, data: ds });
                }}
              >
                Or explore demo data
              </button>
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

export default function ViewPage() {
  return (
    <Suspense fallback={null}>
      <Viewer />
    </Suspense>
  );
}
