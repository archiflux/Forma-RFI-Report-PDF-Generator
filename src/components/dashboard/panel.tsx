"use client";

import { usePanelLayout } from "./layout-context";

// Shown in place of a hidden panel while the dashboard can be edited.
function HiddenBar({ title, onShow }: { title: string; onShow: () => void }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-2xl border border-dashed border-[color:var(--brand-border)] bg-white/60 px-4 py-2 text-xs text-[color:var(--brand-muted)]">
      <span className="min-w-0 truncate">
        <span className="font-semibold text-[color:var(--brand-ink-soft)]">{title}</span> is hidden, and left out of the PDF and shared links.
      </span>
      <button type="button" onClick={onShow} className="font-medium text-[color:var(--brand-secondary)] underline">
        Show
      </button>
    </div>
  );
}

function HideButton({ title, onHide }: { title: string; onHide: () => void }) {
  return (
    <button
      type="button"
      onClick={onHide}
      title={`Hide ${title}`}
      aria-label={`Hide ${title}`}
      className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[color:var(--brand-muted)] transition hover:bg-[color:var(--brand-canvas)] hover:text-[color:var(--brand-primary)]"
    >
      <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
        <path d="M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </button>
  );
}

// `id` names the panel in the dashboard layout (defaults to the title);
// hiding it also drops it from the PDF report and shared links.
export function Panel({ id, title, children, action }: { id?: string; title: string; children: React.ReactNode; action?: React.ReactNode }) {
  const { hidden, toggle } = usePanelLayout();
  const key = id ?? title;
  if (hidden.has(key)) return toggle ? <HiddenBar title={title} onShow={() => toggle(key)} /> : null;
  return (
    <section className="flex h-full min-w-0 flex-col rounded-2xl border border-[color:var(--brand-border)] bg-white p-4 shadow-card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[color:var(--brand-primary)]">{title}</h3>
        <div className="flex flex-wrap items-center gap-2">
          {action}
          {toggle ? <HideButton title={title} onHide={() => toggle(key)} /> : null}
        </div>
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </section>
  );
}

// A hideable block without a panel frame (the key-figure tiles).
export function Hideable({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  const { hidden, toggle } = usePanelLayout();
  if (hidden.has(id)) return toggle ? <HiddenBar title={title} onShow={() => toggle(id)} /> : null;
  return (
    <div className="group relative">
      {children}
      {toggle ? (
        <div className="absolute -right-2 -top-2 rounded-full border border-[color:var(--brand-border)] bg-white opacity-0 shadow-card transition group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
          <HideButton title={title} onHide={() => toggle(id)} />
        </div>
      ) : null}
    </div>
  );
}
