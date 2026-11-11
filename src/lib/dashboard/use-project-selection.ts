"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useApsClient } from "@/lib/aps/use-client";
import { listProjects } from "@/lib/aps/projects";
import { getUserProfile } from "@/lib/aps/user-profile";
import { useProjectSets } from "./use-project-sets";
import { readSelection, writeSelection } from "./selection-url";
import type { ProjectSet } from "./project-sets";

// Shared by every multi-project dashboard: the hub's projects, the ids
// selected in the URL (?p=a,b,c, or ?sel=key for long lists; see
// selection-url.ts) and the user's saved project sets.
export function useProjectSelection() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const hubId = params.get("hubId") ?? "";
  const selected = useMemo(() => readSelection(params), [params]);
  const client = useApsClient();

  const projectsQ = useQuery({
    queryKey: ["projects", hubId],
    queryFn: () => listProjects(client, hubId),
    enabled: Boolean(hubId),
  });
  const meQ = useQuery({ queryKey: ["user-profile"], queryFn: () => getUserProfile(client), staleTime: Infinity });
  const { sets, save, remove, setLayout } = useProjectSets(meQ.data?.userId);

  const setSelected = useCallback(
    (ids: string[]) => {
      const next = new URLSearchParams(params.toString());
      writeSelection(next, ids);
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  const all = useMemo(() => projectsQ.data ?? [], [projectsQ.data]);
  const chosen = useMemo(() => all.filter((p) => selected.includes(p.id)), [all, selected]);
  // The saved set whose projects are exactly the current selection, if any.
  const activeSet = useMemo(() => {
    if (!selected.length) return undefined;
    const want = [...selected].sort().join(",");
    return sets.find((s) => s.hubId === hubId && s.projects.map((p) => p.id).sort().join(",") === want);
  }, [sets, selected, hubId]);

  return {
    hubId,
    projectsQ,
    all,
    selected,
    chosen,
    setSelected,
    sets,
    canSave: Boolean(meQ.data?.userId),
    activeSet,
    saveSet: (name: string, layouts?: ProjectSet["layouts"]) =>
      save({ name, hubId, projects: chosen.map((p) => ({ id: p.id, name: p.name })), ...(layouts ? { layouts } : {}) }),
    removeSet: remove,
    setSetLayout: setLayout,
  };
}
