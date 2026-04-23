"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function BuilderInner() {
  const params = useSearchParams();
  const hubId = params.get("hubId") ?? "";
  const projectId = params.get("projectId") ?? "";

  return (
    <section>
      <h2 className="text-xl font-semibold">Report builder</h2>
      <p className="mt-1 text-sm text-neutral-600">
        Hub <code className="rounded bg-neutral-100 px-1">{hubId}</code> · Project{" "}
        <code className="rounded bg-neutral-100 px-1">{projectId}</code>
      </p>

      <div className="mt-8 rounded-xl border-2 border-dashed border-neutral-300 bg-white p-10 text-center">
        <p className="font-medium">Phase 2 / 3 lands here</p>
        <p className="mt-2 text-sm text-neutral-500">
          Field picker, filter builder, sort, grouping, and template save/load.
          The APS fetchers (<code>scrapeAllRfis</code>, <code>listCustomAttributes</code>)
          are already wired and read-only.
        </p>
        <Link
          href="/projects"
          className="mt-4 inline-block text-sm text-[color:var(--brand-primary)] underline"
        >
          Back to projects
        </Link>
      </div>
    </section>
  );
}

export default function BuilderPage() {
  return (
    <Suspense fallback={<p className="text-sm text-neutral-500">Loading…</p>}>
      <BuilderInner />
    </Suspense>
  );
}
