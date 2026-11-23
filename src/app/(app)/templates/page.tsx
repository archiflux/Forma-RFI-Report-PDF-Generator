"use client";

import Link from "next/link";
import { Suspense } from "react";
import { TEMPLATES, type TemplateStatus } from "@/lib/dashboard/templates";
import { useCanProbe } from "@/lib/auth/use-can-probe";

const BADGE: Record<TemplateStatus, string> = { live: "Available", planned: "Planned" };

function Catalogue() {
  const { allowed: canProbe } = useCanProbe();
  const templates = TEMPLATES.filter((t) => !t.hidden);
  return (
    <section>
      {/* Hero band: one per page. */}
      <div className="sb-enter relative bg-[color:var(--bp-teal-deep)] px-5 py-5 text-white sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/70">Keep your projects in sight</p>
            <h2 className="mt-2 font-display text-3xl font-semibold leading-10 tracking-[0.01em] text-white sm:text-4xl">
              <span className="text-[color:var(--bp-citron)]">Dashboard</span> templates
            </h2>
            <p className="mt-1.5 text-sm text-white/75">Pick a dashboard, then tick the projects you want to include.</p>
          </div>
          {canProbe ? (
            <Link href="/hubs" className="text-sm font-semibold text-white underline decoration-white/40 underline-offset-4">
              Run the data probe
            </Link>
          ) : null}
        </div>
      </div>

      <h3 className="bp-bar mt-7 bg-[color:var(--bp-teal)] px-2.5 py-1 text-white">
        Dashboards <span className="font-medium tabular-nums">{templates.length}</span>
      </h3>
      <ul className="mt-2 grid gap-2 md:grid-cols-2">
        {templates.map((t, i) => (
          <li
            key={t.id}
            className="sb-enter sb-lift group relative flex flex-col border-l-4 border-[color:var(--bp-teal)] bg-white px-4 py-4 shadow-hp-sm"
            style={{ ["--sb-i" as string]: i }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-[color:var(--bp-teal)] text-white" aria-hidden>
                  <TemplateIcon id={t.id} />
                </span>
                <p className="text-base font-semibold text-[color:var(--bp-ink)]">{t.title}</p>
              </div>
              <span
                className={`px-1.5 py-0.5 text-[11px] font-semibold uppercase leading-4 tracking-[0.025em] ${
                  t.status === "planned" ? "bg-[color:var(--slate-200)] text-[color:var(--slate-700)]" : "bg-[color:var(--bp-teal)] text-white"
                }`}
              >
                {BADGE[t.status]}
              </span>
            </div>
            <div className="mt-2 flex gap-1.5">
              {t.scope.map((s) => (
                <span key={s} className="border border-[color:var(--bp-rule)] px-1.5 py-px text-[11px] font-semibold uppercase leading-4 tracking-[0.025em] text-[color:var(--slate-600)]">
                  {s}
                </span>
              ))}
            </div>
            <p className="mt-3 flex-1 text-sm text-[color:var(--slate-700)]">{t.description}</p>
            <p className="mt-2 text-xs text-[color:var(--slate-600)]">Data: {t.probeAreas.join(", ")}</p>
            {t.href ? (
              <Link
                href={t.href}
                className="sb-sheen mt-4 inline-flex w-fit items-center gap-1.5 bg-[color:var(--bp-teal)] px-3.5 py-2 text-sm font-semibold text-white shadow-hp-sm transition-[background-color,box-shadow,transform] duration-150 hover:bg-[color:var(--bp-teal-dark)] hover:shadow-hp-md active:scale-[0.97]"
              >
                Open {t.title.replace(/ Dashboard$/i, "")} dashboard →
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

// Simple line icons, one per dashboard, with a yellow accent.
function TemplateIcon({ id }: { id: string }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
      {id === "issues" ? (
        <>
          <path d="M10 2.5 18 16.5H2z" {...p} />
          <path d="M10 8v3.5" {...p} stroke="var(--bp-citron)" />
          <circle cx="10" cy="14" r="0.9" fill="var(--bp-citron)" />
        </>
      ) : id === "forms" ? (
        <>
          <rect x="4" y="3" width="12" height="15" rx="2" {...p} />
          <path d="M7.5 3V2h5v1" {...p} />
          <path d="M7 9h6M7 12h6M7 15h3.5" {...p} stroke="var(--bp-citron)" />
        </>
      ) : id === "reviews" ? (
        <>
          <path d="M5 2.5h7l3.5 3.5v11.5H5z" {...p} />
          <path d="m7.5 11.5 2 2 3.5-4" {...p} stroke="var(--bp-citron)" />
        </>
      ) : (
        <>
          <path d="M3 4.5h14v9H8l-4 3v-3H3z" {...p} />
          <path d="M8.3 7.3a1.8 1.8 0 1 1 2.3 1.7c-.4.2-.6.5-.6.9v.3" {...p} stroke="var(--bp-citron)" />
          <circle cx="10" cy="11.6" r="0.6" fill="var(--bp-citron)" />
        </>
      )}
    </svg>
  );
}

export default function TemplatesPage() {
  return (
    <Suspense fallback={<p className="text-sm">Loading…</p>}>
      <Catalogue />
    </Suspense>
  );
}
