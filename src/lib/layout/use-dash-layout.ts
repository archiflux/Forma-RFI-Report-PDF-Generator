"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { useProjectSelection } from "@/lib/dashboard/use-project-selection";
import { EMPTY_LAYOUT, loadLastLayout, saveLastLayout, type DashKind, type DashLayout } from "./layout";

type Selection = ReturnType<typeof useProjectSelection>;

// A signed-in dashboard's layout. It starts from the last one used in this
// browser; loading a saved project set applies the layout saved with it,
// and changes made while that set is loaded are saved back to the set.
// Returns `sel` with saveSet() also capturing this layout, for the sidebar.
export function useDashLayout(kind: DashKind, sel: Selection) {
  const [layout, setState] = useState<DashLayout>(EMPTY_LAYOUT);
  useEffect(() => {
    setState(loadLastLayout(kind));
  }, [kind]);

  const active = sel.activeSet;
  const applied = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!active || applied.current === active.id) {
      if (!active) applied.current = undefined;
      return;
    }
    applied.current = active.id;
    const saved = active.layouts?.[kind];
    if (saved) {
      setState(saved);
      saveLastLayout(kind, saved);
    }
  }, [active, kind]);

  const activeId = active?.id;
  const { setSetLayout, saveSet } = sel;
  const setLayout = useCallback(
    (l: DashLayout) => {
      setState(l);
      saveLastLayout(kind, l);
      if (activeId) setSetLayout(activeId, kind, l);
    },
    [kind, activeId, setSetLayout],
  );

  const selWithLayout: Selection = { ...sel, saveSet: (name, layouts) => saveSet(name, { ...layouts, [kind]: layout }) };
  return { layout, setLayout, sel: selWithLayout };
}
