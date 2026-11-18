"use client";

import Link from "next/link";
import { Suspense } from "react";
import { TEMPLATES, type TemplateStatus } from "@/lib/dashboard/templates";
import { useCanProbe } from "@/lib/auth/use-can-probe";

const BADGE: Record<TemplateStatus, string> = { live: "Dashboard", planned: "Planned" };

function Catalogue() {
  const { allowed: canProbe } = useCanProbe();
  const templates = TEMPLATES.filter((t) => !t.hidden);
  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-[color:var(--brand-primary)] sm:text-3xl">Dashboard templates</h2>
          <span className="mt-1.5 block h-1 w-14 rounded-full" style={{ background: "var(--brand-gradient)" }} aria-hidden />
          <p className="mt-1 text-sm text-[color:var(--brand-muted)]">
            Pick a dashboard, then tick the projects you want to include.
          </p>
        </div>
        {canProbe ? (
          <Link href="/hubs" className="text-sm font-medium text-[color:var(--brand-secondary)] underline-offset-4 hover:underline">
            Run the data probe
          </Link>
        ) : null}
      </div>
      <ul className="mt-6 grid gap-4 md:grid-cols-2">
        {templates.map((t, i) => (
          <li
            key={t.id}
            className="sb-enter sb-lift group relative flex flex-col overflow-hidden rounded-2xl border border-[color:var(--brand-border)] bg-white p-5 shadow-card"
            style={{ ["--sb-i" as string]: i }}
          >
            <span className="absolute inset-x-0 top-0 h-1 origin-left scale-x-[0.25] transition-transform duration-500 group-hover:scale-x-100" style={{ background: "var(--brand-gradient)" }} aria-hidden />
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-[0_8px_18px_-8px_rgba(0,104,129,0.8)] transition-transform duration-300 group-hover:rotate-[-6deg] group-hover:scale-110"
                  style={{ background: "linear-gradient(135deg, #006881, #0e2841)" }}
                  aria-hidden
                >
                  <TemplateIcon id={t.id} />
                </span>
                <p className="text-lg font-semibold text-[color:var(--brand-primary)]">{t.title}</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${t.status === "planned" ? "bg-[color:var(--brand-canvas)] text-[color:var(--brand-muted)]" : "bg-[color:var(--brand-accent-soft)] text-[color:var(--brand-primary)] ring-1 ring-[#d1c800]"}`}>
                {BADGE[t.status]}
              </span>
            </div>
            <div className="mt-2 flex gap-1.5">
              {t.scope.map((s) => (
                <span key={s} className="rounded-full bg-[color:var(--brand-teal-soft)] px-2 py-0.5 text-[11px] font-medium text-[color:var(--brand-teal)]">{s}</span>
              ))}
            </div>
            <p className="mt-3 flex-1 text-sm text-[color:var(--brand-ink-soft)]">{t.description}</p>
            <p className="mt-2 text-xs text-[color:var(--brand-muted)]">Data: {t.probeAreas.join(", ")}</p>
            {t.href ? (
              <Link
                href={t.href}
                className="mt-4 inline-flex w-fit items-center gap-2 rounded-lg bg-[color:var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-[color:var(--brand-teal)] hover:shadow-[0_8px_20px_-8px_rgba(0,104,129,0.6)] active:scale-[0.97]"
              >
                Open
                <span className="transition-transform duration-200 group-hover:translate-x-1" aria-hidden>
                  →
                </span>
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
          <path d="M10 8v3.5" {...p} stroke="#d1c800" />
          <circle cx="10" cy="14" r="0.9" fill="#d1c800" />
        </>
      ) : id === "forms" ? (
        <>
          <rect x="4" y="3" width="12" height="15" rx="2" {...p} />
          <path d="M7.5 3V2h5v1" {...p} />
          <path d="M7 9h6M7 12h6M7 15h3.5" {...p} stroke="#d1c800" />
        </>
      ) : id === "reviews" ? (
        <>
          <path d="M5 2.5h7l3.5 3.5v11.5H5z" {...p} />
          <path d="m7.5 11.5 2 2 3.5-4" {...p} stroke="#d1c800" />
        </>
      ) : (
        <>
          <path d="M3 4.5h14v9H8l-4 3v-3H3z" {...p} />
          <path d="M8.3 7.3a1.8 1.8 0 1 1 2.3 1.7c-.4.2-.6.5-.6.9v.3" {...p} stroke="#d1c800" />
          <circle cx="10" cy="11.6" r="0.6" fill="#d1c800" />
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
