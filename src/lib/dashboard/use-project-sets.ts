"use client";

import { useCallback, useEffect, useState } from "react";
import { deleteSet, loadSets, saveSet, updateSetLayout, type ProjectSet } from "./project-sets";
import type { DashKind, DashLayout } from "@/lib/layout/layout";

export function useProjectSets(userId: string | undefined) {
  const [sets, setSets] = useState<ProjectSet[]>([]);
  useEffect(() => {
    setSets(userId ? loadSets(userId) : []);
  }, [userId]);
  const save = useCallback(
    (input: Omit<ProjectSet, "id" | "updatedAt">) => {
      if (userId) setSets(saveSet(userId, input));
    },
    [userId],
  );
  const remove = useCallback(
    (id: string) => {
      if (userId) setSets(deleteSet(userId, id));
    },
    [userId],
  );
  const setLayout = useCallback(
    (id: string, kind: DashKind, layout: DashLayout) => {
      if (userId) setSets(updateSetLayout(userId, id, kind, layout));
    },
    [userId],
  );
  return { sets, save, remove, setLayout };
}
