"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { EMPTY_LAYOUT, toggleHidden, type DashLayout } from "@/lib/layout/layout";

// Which panels are hidden on this dashboard, and (when the viewer may
// change it) how to toggle one. Shared links get no toggle: hidden panels
// are simply left out.
export interface PanelLayout {
  hidden: ReadonlySet<string>;
  toggle?: (id: string) => void;
}

export const PanelLayoutContext = createContext<PanelLayout>({ hidden: new Set() });

export function usePanelLayout(): PanelLayout {
  return useContext(PanelLayoutContext);
}

// A view's layout. With `onChange` (the signed-in dashboard) the parent owns
// it and panels can be hidden. Without (a shared link) it starts from the
// shared layout: hidden panels stay hidden, and the viewer can still re-sort
// or change register columns for themselves.
export function useViewLayout(layout: DashLayout | undefined, onChange: ((l: DashLayout) => void) | undefined) {
  const [local, setLocal] = useState<DashLayout>(layout ?? EMPTY_LAYOUT);
  const current = onChange ? (layout ?? EMPTY_LAYOUT) : local;
  const set = onChange ?? setLocal;
  const panels = useMemo<PanelLayout>(
    () => ({ hidden: new Set(current.hidden), ...(onChange ? { toggle: (id: string) => onChange(toggleHidden(current, id)) } : {}) }),
    [current, onChange],
  );
  return { layout: current, setLayout: set, panels };
}
