"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { withBase } from "@/lib/base-path";
import { useCountUp } from "@/components/ui/stat-tile";

// Page heading shared by the dashboards, with the loading banner under it.
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
  return (
    <>
      <div className="sb-enter flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-[color:var(--brand-primary)] sm:text-3xl">{title}</h2>
          <span className="mt-1.5 block h-1 w-14 rounded-full" style={{ background: "var(--brand-gradient)" }} aria-hidden />
          <p className="mt-2 text-sm text-[color:var(--brand-muted)]">{intro}</p>
        </div>
        {aside}
      </div>
      <LoadingBanner loading={loading} total={total} records={records} noun={noun} />
    </>
  );
}

// Prominent progress while projects load from Forma; once everything is in,
// it says so briefly and folds away.
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

  return (
    <>
      {/* Visible wherever you are on the page: a progress line along the top
          of the screen, and on phones (where the project list comes first) a
          floating pill. */}
      {!finished
        ? createPortal(
            <>
              <div className="fixed inset-x-0 top-0 z-[60] h-[3px] bg-[#006881]/15" aria-hidden>
                <div className="sb-bar-fill h-full" style={{ width: `${Math.max(4, pct)}%` }} />
              </div>
              <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex justify-center lg:hidden" aria-hidden>
                <div
                  className="sb-enter flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium text-white shadow-[0_12px_30px_-10px_rgba(0,104,129,0.8)]"
                  style={{ background: "linear-gradient(120deg, #0e2841, #006881)" }}
                >
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-[#d1c800] border-t-transparent" style={{ animation: "sb-spin 0.8s linear infinite" }} />
                  Loading projects: {done.toLocaleString("en-GB")} of {total.toLocaleString("en-GB")}
                </div>
              </div>
            </>,
            document.body,
          )
        : null}
    <div
      className="sb-enter sticky top-[4.75rem] z-10 overflow-hidden rounded-2xl text-white shadow-[0_18px_40px_-16px_rgba(0,104,129,0.55)]"
      style={{ background: "linear-gradient(120deg, #0e2841 0%, #0b4a63 55%, #006881 100%)" }}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-4 px-4 py-3 sm:px-5">
        <div className="relative h-11 w-11 shrink-0">
          {finished ? (
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#d1c800] text-[#0e2841]">
              <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
                <path d="M5 10.5 8.5 14 15 6.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          ) : (
            <>
              <span className="absolute inset-0 rounded-full bg-[#d1c800]/40" style={{ animation: "sb-pulse-ring 1.6s ease-out infinite" }} />
              <span
                className="absolute inset-0 rounded-full"
                style={{
                  background: "conic-gradient(from 0deg, #d1c800, rgba(209,200,0,0) 70%)",
                  animation: "sb-spin 1s linear infinite",
                  WebkitMask: "radial-gradient(circle, transparent 58%, #000 60%)",
                  mask: "radial-gradient(circle, transparent 58%, #000 60%)",
                }}
              />
              <span className="absolute inset-[7px] overflow-hidden rounded-full bg-white">
                <Image src={withBase("/icon-colour.png")} alt="" width={30} height={30} className="h-full w-full object-contain" />
              </span>
            </>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {finished ? `All ${total.toLocaleString("en-GB")} project${total === 1 ? "" : "s"} loaded` : "Fetching from Autodesk Forma…"}
          </p>
          <p className="text-xs text-white/75 tabular-nums">
            {finished ? "" : `${done.toLocaleString("en-GB")} of ${total.toLocaleString("en-GB")} projects · `}
            {shownRecords.toLocaleString("en-GB")} {noun}
            {finished ? "" : " so far"}
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/15">
            <div className="sb-bar-fill h-full rounded-full" style={{ width: `${Math.max(4, pct)}%` }} />
          </div>
        </div>
        <p className="hidden text-2xl font-semibold tabular-nums text-[#d1c800] sm:block">{pct}%</p>
      </div>
    </div>
    </>
  );
}

// Shimmering placeholders shown until the first records arrive.
export function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="sb-enter rounded-xl border border-[color:var(--brand-border)] bg-white p-4 shadow-card" style={{ ["--sb-i" as string]: i }}>
            <div className="sb-skeleton h-3 w-20 rounded" />
            <div className="sb-skeleton mt-3 h-7 w-14 rounded" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="sb-enter rounded-2xl border border-[color:var(--brand-border)] bg-white p-4 shadow-card" style={{ ["--sb-i" as string]: i + 6 }}>
            <div className="sb-skeleton h-4 w-40 rounded" />
            <div className="mt-4 flex h-40 items-end gap-2">
              {[55, 80, 40, 95, 65, 30, 75, 50].map((h, j) => (
                <div key={j} className="sb-skeleton flex-1 rounded-t" style={{ height: `${h}%`, animationDelay: `${j * 80}ms` }} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
