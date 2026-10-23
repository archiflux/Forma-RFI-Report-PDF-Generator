"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useApsClient } from "@/lib/aps/use-client";
import { listProjects } from "@/lib/aps/projects";
import { getUserProfile } from "@/lib/aps/user-profile";
import { useProjectSets } from "./use-project-sets";

// Shared by every multi-project dashboard: the hub's projects, the ids
// selected in the URL (?p=a,b,c) and the user's saved project sets.
export function useProjectSelection() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const hubId = params.get("hubId") ?? "";
  const selected = useMemo(() => (params.get("p") ?? "").split(",").filter(Boolean), [params]);
  const client = useApsClient();

  const projectsQ = useQuery({
    queryKey: ["projects", hubId],
    queryFn: () => listProjects(client, hubId),
    enabled: Boolean(hubId),
  });
  const meQ = useQuery({ queryKey: ["user-profile"], queryFn: () => getUserProfile(client), staleTime: Infinity });
  const { sets, save, remove } = useProjectSets(meQ.data?.userId);

  const setSelected = useCallback(
    (ids: string[]) => {
      const next = new URLSearchParams(params.toString());
      if (ids.length) next.set("p", ids.join(","));
      else next.delete("p");
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  const all = useMemo(() => projectsQ.data ?? [], [projectsQ.data]);
  const chosen = useMemo(() => all.filter((p) => selected.includes(p.id)), [all, selected]);

  return {
    hubId,
    projectsQ,
    all,
    selected,
    chosen,
    setSelected,
    sets,
    canSave: Boolean(meQ.data?.userId),
    saveSet: (name: string) => save({ name, hubId, projects: chosen.map((p) => ({ id: p.id, name: p.name })) }),
    removeSet: remove,
  };
}
