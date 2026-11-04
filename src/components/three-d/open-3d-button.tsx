"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Universe3D } from "@/lib/three-d/universe";

// three.js (~150 KB gzipped) loads only when someone opens the 3D view.
const UniverseViewer = dynamic(() => import("./universe-viewer"), { ssr: false });

// "3D view" button for a dashboard toolbar. `build` turns the currently
// filtered records into cubes. Opening pushes a history entry so the browser
// or phone back gesture returns to the dashboard with filters intact.
export function Open3DButton({ build }: { build: () => Universe3D }) {
  const [universe, setUniverse] = useState<Universe3D | null>(null);
  const pushed = useRef(false);

  const close = useCallback(() => {
    if (pushed.current) window.history.back();
    else setUniverse(null);
  }, []);

  useEffect(() => {
    if (!universe) return;
    const onPop = () => {
      pushed.current = false;
      setUniverse(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("popstate", onPop);
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [universe, close]);

  const open = () => {
    window.history.pushState({ ...(window.history.state as object | null), siteboard3d: true }, "");
    pushed.current = true;
    setUniverse(build());
  };

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[color:var(--brand-primary)] bg-[color:var(--brand-primary)] px-3 text-xs font-semibold text-white transition hover:brightness-125"
      >
        <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden>
          <path d="M8 1.5 14 5v6l-6 3.5L2 11V5z M2 5l6 3.5L14 5 M8 8.5v6" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        </svg>
        3D view
      </button>
      {universe ? createPortal(<UniverseViewer universe={universe} onBack={close} />, document.body) : null}
    </>
  );
}
