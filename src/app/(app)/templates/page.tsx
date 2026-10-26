"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { TEMPLATES, type TemplateStatus } from "@/lib/dashboard/templates";
import { useCanProbe } from "@/lib/auth/use-can-probe";

const BADGE: Record<TemplateStatus, string> = { live: "Dashboard", planned: "Planned" };

function Catalogue() {
  const hubId = useSearchParams().get("hubId") ?? "";
  const { allowed: canProbe } = useCanProbe();
  const templates = TEMPLATES.filter((t) => !t.hidden);
  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-[color:var(--brand-primary)]">Dashboard templates</h2>
          <p className="mt-1 text-sm text-[color:var(--brand-muted)]">
            Pick a dashboard, then tick the projects you want to include.
          </p>
        </div>
        {hubId && canProbe ? (
          <Link href={`/probe?hubId=${encodeURIComponent(hubId)}`} className="text-sm font-medium text-[color:var(--brand-secondary)] underline-offset-4 hover:underline">
            Run the data probe
          </Link>
        ) : !hubId ? (
          <Link href="/hubs" className="text-sm underline">Choose a hub first</Link>
        ) : null}
      </div>
      <ul className="mt-6 grid gap-4 md:grid-cols-2">
        {templates.map((t) => (
          <li key={t.id} className="flex flex-col rounded-2xl border border-[color:var(--brand-border)] bg-white p-5 shadow-card">
            <div className="flex items-start justify-between gap-2">
              <p className="text-lg font-semibold text-[color:var(--brand-primary)]">{t.title}</p>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${t.status === "planned" ? "bg-[color:var(--brand-canvas)] text-[color:var(--brand-muted)]" : "bg-[color:var(--brand-primary)] text-white"}`}>
                {BADGE[t.status]}
              </span>
            </div>
            <div className="mt-2 flex gap-1.5">
              {t.scope.map((s) => (
                <span key={s} className="rounded-full bg-[color:var(--brand-canvas)] px-2 py-0.5 text-[11px] font-medium text-[color:var(--brand-ink-soft)]">{s}</span>
              ))}
            </div>
            <p className="mt-3 flex-1 text-sm text-[color:var(--brand-ink-soft)]">{t.description}</p>
            <p className="mt-2 text-xs text-[color:var(--brand-muted)]">Data: {t.probeAreas.join(", ")}</p>
            {t.href && hubId ? (
              <Link href={t.href(hubId)} className="mt-4 inline-flex w-fit rounded-lg bg-[color:var(--brand-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[color:var(--brand-secondary)]">
                Open
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function TemplatesPage() {
  return (
    <Suspense fallback={<p className="text-sm">Loading…</p>}>
      <Catalogue />
    </Suspense>
  );
}
