"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useCountUp } from "@/components/ui/stat-tile";
import { SiteboardMark } from "@/components/ui/siteboard-mark";

// Holdpoint hero band for each dashboard (one per page): teal-deep ground,
// a small uppercase kicker, a Chakra Petch title with a citron lead-in, and
// the loading progress under it.
export function DashTitle({
  title,
  intro,
  aside,
  loading,
  total,
  records,
  noun,
}: {
  title: string;
  intro: React.ReactNode;
  aside?: React.ReactNode;
  loading: number;
  total: number;
  records: number;
  noun: string;
}) {
  // "Issues dashboard" -> citron "Issues", white "dashboard".
  const [lead, ...rest] = title.split(" ");
  return (
    <>
      <div className="sb-enter relative overflow-hidden bg-[color:var(--bp-teal-deep)] px-5 pb-4 pt-4 text-white sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/70">Siteboard dashboard</p>
            <h2 className="mt-2 font-display text-3xl font-semibold leading-10 tracking-[0.01em] text-white sm:text-4xl">
              <span className="text-[color:var(--bp-citron)]">{lead}</span> {rest.join(" ")}
            </h2>
            <p className="mt-1.5 text-sm text-white/75">{intro}</p>
          </div>
          {aside ? <div className="text-sm [&_a]:text-white [&_a]:underline [&_a]:decoration-white/40">{aside}</div> : null}
        </div>
      </div>
      <LoadingBanner loading={loading} total={total} records={records} noun={noun} />
    </>
  );
}

// Loading progress while projects come in from Forma: a white card with a
// citron edge, the Siteboard mark drawing itself, live counts and a citron
// bar that grows. Once everything is in it says so briefly, then goes.
export function LoadingBanner({ loading, total, records, noun }: { loading: number; total: number; records: number; noun: string }) {
  const done = total - loading;
  const wasLoading = useRef(false);
  const [justFinished, setJustFinished] = useState(false);
  useEffect(() => {
    if (loading > 0) {
      wasLoading.current = true;
      setJustFinished(false);
      return;
    }
    if (!wasLoading.current) return;
    wasLoading.current = false;
    setJustFinished(true);
    const t = setTimeout(() => setJustFinished(false), 2800);
    return () => clearTimeout(t);
  }, [loading]);
  const shownRecords = useCountUp(records, 500);
  if (!total || (loading === 0 && !justFinished)) return null;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const finished = loading === 0;
  const frac = Math.max(0.03, done / total);

  return (
    <>
      {/* Seen wherever you are on the page: a citron line along the top of
          the screen, and on phones (where the project list comes first) a
          small status chip at the bottom. */}
      {!finished
        ? createPortal(
            <>
              <div className="fixed inset-x-0 top-0 z-[60] h-1 bg-[rgba(0,104,129,0.2)]" aria-hidden>
                <div className="sb-bar-fill h-full w-full" style={{ transform: `scaleX(${frac})` }} />
              </div>
              <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex justify-center lg:hidden" aria-hidden>
                <div className="flex items-center gap-2 border-l-4 border-[color:var(--bp-citron)] bg-[color:var(--bp-teal-deep)] px-3 py-2 text-xs font-semibold text-white shadow-hp-lg">
                  <SiteboardMark size={16} loading tone="white" />
                  Loading projects: {done.toLocaleString("en-GB")} of {total.toLocaleString("en-GB")}
                </div>
              </div>
            </>,
            document.body,
          )
        : null}
      <div
        className={`sticky top-[4.4rem] z-10 border-l-4 bg-white px-4 py-3 shadow-hp-lg ${finished ? "border-[color:var(--done-bar)]" : "border-[color:var(--bp-citron)]"}`}
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center gap-3">
          {finished ? (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-[color:var(--done)] text-white">
              <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden>
                <path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="square" />
              </svg>
            </span>
          ) : (
            <SiteboardMark size={36} loading className="shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[color:var(--bp-ink)]">
              {finished ? `All ${total.toLocaleString("en-GB")} project${total === 1 ? "" : "s"} loaded` : "Fetching from Autodesk Forma"}
            </p>
            <p className="text-xs tabular-nums text-[color:var(--slate-600)]">
              {finished ? "" : `${done.toLocaleString("en-GB")} of ${total.toLocaleString("en-GB")} projects · `}
              {shownRecords.toLocaleString("en-GB")} {noun}
              {finished ? "" : " so far"}
            </p>
          </div>
          <p className="hidden font-display text-[30px] font-semibold leading-9 tabular-nums text-[color:var(--bp-teal)] sm:block">{pct}%</p>
        </div>
        <div className="mt-2 h-1.5 bg-[color:var(--slate-200)]">
          <div
            className={`h-full w-full origin-left transition-transform duration-500 ${finished ? "bg-[color:var(--done-bar)]" : "bg-[color:var(--bp-citron)]"}`}
            style={{ transform: `scaleX(${frac})` }}
          />
        </div>
      </div>
    </>
  );
}

// Grey placeholders shown until the first records arrive.
export function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="border-t-4 border-[color:var(--slate-200)] bg-white px-4 py-3 shadow-hp-sm">
            <div className="sb-skeleton h-3 w-20" />
            <div className="sb-skeleton mt-3 h-8 w-14" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i}>
            <div className="h-[26px] bg-[rgba(0,104,129,0.25)]" />
            <div className="bg-white p-4 shadow-hp-sm">
              <div className="flex h-40 items-end gap-2">
                {[55, 80, 40, 95, 65, 30, 75, 50].map((h, j) => (
                  <div key={j} className="sb-skeleton flex-1" style={{ height: `${h}%`, animationDelay: `${j * 80}ms` }} />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
