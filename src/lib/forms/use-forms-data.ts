"use client";

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { useApsClient } from "@/lib/aps/use-client";
import { getFormTemplateNames, scrapeRawForms } from "@/lib/aps/forms";
import { getProjectDirectory } from "@/lib/aps/users";
import type { ApsClient } from "@/lib/aps/client";
import { ApsError } from "@/lib/aps/types";
import { normaliseForm } from "./normalise";
import type { FormRecord, FormsDataset, FormsProject } from "./types";

const STALE_MS = 10 * 60_000;

async function loadProject(
  client: ApsClient,
  project: { id: string; name: string },
): Promise<{ project: FormsProject; forms: FormRecord[] }> {
  let raw: unknown[];
  try {
    raw = await scrapeRawForms(client, project.id);
  } catch (e) {
    // 404 = Forms tool not activated in this project.
    if (e instanceof ApsError && e.status === 404) {
      return { project: { id: project.id, name: project.name, formCount: 0, formsUnavailable: true }, forms: [] };
    }
    throw e;
  }
  const [templates, directory] = await Promise.all([
    getFormTemplateNames(client, project.id),
    getProjectDirectory(client, project.id).catch(() => ({ people: new Map<string, string>() })),
  ]);
  const ctx = { projectId: project.id, projectName: project.name, templates, people: directory.people };
  const forms = raw.flatMap((r) => {
    const f = normaliseForm(r, ctx);
    return f ? [f] : [];
  });
  return { project: { id: project.id, name: project.name, formCount: forms.length }, forms };
}

export function useFormsData(projects: Array<{ id: string; name: string }>) {
  const client = useApsClient();
  const results = useQueries({
    queries: projects.map((p) => ({
      queryKey: ["forms-project", p.id],
      queryFn: () => loadProject(client, p),
      staleTime: STALE_MS,
    })),
  });
  const loading = results.filter((r) => r.isLoading).length;
  const dataKey = results.map((r) => r.dataUpdatedAt).join(",");

  const dataset = useMemo<FormsDataset>(() => {
    const out: FormsDataset = { projects: [], forms: [] };
    results.forEach((r, idx) => {
      const p = projects[idx];
      if (!p) return;
      if (r.data) {
        out.projects.push(r.data.project);
        out.forms.push(...r.data.forms);
      } else {
        out.projects.push({
          id: p.id,
          name: p.name,
          formCount: 0,
          ...(r.error ? { error: r.error instanceof Error ? r.error.message : String(r.error) } : {}),
        });
      }
    });
    return out;
    // results identity changes every render; dataKey captures real updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey, projects, loading]);

  return { dataset, loading, total: projects.length };
}
