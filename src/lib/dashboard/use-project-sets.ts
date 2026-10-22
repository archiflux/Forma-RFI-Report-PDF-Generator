"use client";

import { useCallback, useEffect, useState } from "react";
import { deleteSet, loadSets, saveSet, type ProjectSet } from "./project-sets";

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
  return { sets, save, remove };
}
