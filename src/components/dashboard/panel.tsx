"use client";

import { usePanelLayout } from "./layout-context";

// Shown in place of a hidden panel while the dashboard can be edited.
function HiddenBar({ title, onShow }: { title: string; onShow: () => void }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border border-dashed border-[color:var(--bp-rule)] bg-white/60 px-3 py-2 text-xs text-[color:var(--slate-600)]">
      <span className="min-w-0 truncate">
        <span className="font-semibold text-[color:var(--brand-ink-soft)]">{title}</span> is hidden, and left out of the PDF and shared links.
      </span>
      <button type="button" onClick={onShow} className="font-medium text-[color:var(--brand-secondary)] underline">
        Show
      </button>
    </div>
  );
}

function HideButton({ title, onHide, onBar = false }: { title: string; onHide: () => void; onBar?: boolean }) {
  return (
    <button
      type="button"
      onClick={onHide}
      title={`Hide ${title}`}
      aria-label={`Hide ${title}`}
      className={`inline-flex h-6 w-6 items-center justify-center transition-colors ${
        onBar ? "text-white/80 hover:bg-white/15 hover:text-white" : "text-[color:var(--slate-600)] hover:bg-[color:var(--bp-desk)] hover:text-[color:var(--bp-teal)]"
      }`}
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
    // Holdpoint section: a full-width teal header bar, then the content on a
    // white card.
    <section className="sb-enter relative flex h-full min-w-0 flex-col">
      <div className="bp-bar flex min-h-[26px] flex-wrap items-center justify-between gap-2 bg-[color:var(--bp-teal)] px-2.5 py-1 text-white">
        <h3 className="text-white">{title}</h3>
        {toggle ? <HideButton title={title} onHide={() => toggle(key)} onBar /> : null}
      </div>
      <div className="min-w-0 flex-1 bg-white p-4 shadow-hp-sm">
        {/* Controls and keys sit at the top of the card, not on the bar. */}
        {action ? <div className="mb-3 flex flex-wrap items-center justify-end gap-2">{action}</div> : null}
        {children}
      </div>
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
        <div className="absolute -right-2 -top-2 z-10 border border-[color:var(--bp-rule)] bg-white opacity-0 shadow-hp-sm transition group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
          <HideButton title={title} onHide={() => toggle(id)} />
        </div>
      ) : null}
    </div>
  );
}
