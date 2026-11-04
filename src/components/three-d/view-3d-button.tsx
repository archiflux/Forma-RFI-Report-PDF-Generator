"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Scene3D } from "@/lib/three-d/spec";

// three.js (~150 KB gzipped) loads only when someone opens a 3D view.
const Viewer3D = dynamic(() => import("./viewer"), { ssr: false });

// "View in 3D" button for a panel. Opening pushes a history entry so the
// browser or phone back gesture closes the view and returns to the
// dashboard with its filters intact.
export function View3DButton({ build }: { build: () => Scene3D | null }) {
  const [spec, setSpec] = useState<Scene3D | null>(null);
  const pushed = useRef(false);

  const close = useCallback(() => {
    if (pushed.current) {
      window.history.back();
    } else {
      setSpec(null);
    }
  }, []);

  useEffect(() => {
    if (!spec) return;
    const onPop = () => {
      pushed.current = false;
      setSpec(null);
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
  }, [spec, close]);

  const open = () => {
    const s = build();
    if (!s) return;
    window.history.pushState({ ...(window.history.state as object | null), siteboard3d: true }, "");
    pushed.current = true;
    setSpec(s);
  };

  return (
    <>
      <button
        type="button"
        onClick={open}
        title="View in 3D"
        className="inline-flex min-h-7 items-center gap-1 rounded-full border border-[color:var(--brand-border)] bg-white px-2.5 text-[11px] font-semibold text-[color:var(--brand-secondary)] transition hover:border-[color:var(--brand-secondary)] hover:bg-[color:var(--brand-canvas)]"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
          <path d="M8 1.5 14 5v6l-6 3.5L2 11V5z M2 5l6 3.5L14 5 M8 8.5v6" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        </svg>
        3D
      </button>
      {spec ? createPortal(<Viewer3D spec={spec} onBack={close} />, document.body) : null}
    </>
  );
}
