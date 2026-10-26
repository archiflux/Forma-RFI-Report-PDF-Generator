"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useApsClient } from "@/lib/aps/use-client";
import { listProjects } from "@/lib/aps/projects";
import { PROBE_TARGETS, runDataConnectorCheck, runProbe, type ProbeResult } from "@/lib/aps/probe";
import { ScanPanel } from "@/components/probe/scan-panel";
import { useCanProbe } from "@/lib/auth/use-can-probe";

// Field names and counts only — never values — so the summary is safe to
// paste into a chat or ticket.
function summarise(results: ProbeResult[]): string {
  const lines = ["| Area | Endpoint | Status | Records | Fields with data |", "|---|---|---|---|---|"];
  for (const r of results) {
    const fields = r.coverage.filter((c) => c.share > 0).map((c) => `${c.field} ${Math.round(c.share * 100)}%`).join(", ");
    const notes = r.notes?.length ? ` Notes: ${r.notes.join("; ")}` : "";
    lines.push(`| ${r.group} | ${r.label} | ${r.status} | ${r.total ?? r.count ?? "-"} | ${fields || r.message || "-"}${notes} |`);
  }
  return lines.join("\n");
}

function Probe() {
  const params = useSearchParams();
  const hubId = params.get("hubId") ?? "";
  const client = useApsClient();
  const [projectId, setProjectId] = useState(params.get("projectId") ?? "");
  const [results, setResults] = useState<ProbeResult[]>([]);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const projectsQ = useQuery({ queryKey: ["projects", hubId], queryFn: () => listProjects(client, hubId), enabled: Boolean(hubId) });

  async function run() {
    setRunning(true);
    setResults([]);
    const out: ProbeResult[] = [];
    // Four at a time keeps us well under APS rate limits.
    for (let i = 0; i < PROBE_TARGETS.length; i += 4) {
      const batch = await Promise.all(PROBE_TARGETS.slice(i, i + 4).map((t) => runProbe(client, t, hubId, projectId)));
      out.push(...batch);
      setResults([...out]);
    }
    out.push(...(await runDataConnectorCheck(client, hubId)));
    setResults([...out]);
    setRunning(false);
  }

  if (!hubId) return <p className="text-sm">Pick a hub first - <Link href="/hubs" className="underline">choose hub</Link>.</p>;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold text-[color:var(--brand-primary)]">Data extraction probe</h2>
        <p className="mt-1 max-w-3xl text-sm text-[color:var(--brand-muted)]">
          Calls each read-only Forma API for one project with your account and reports what comes back. Use it to see which dashboard templates your projects can support. Nothing is written to Forma.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="min-h-10 max-w-md rounded-lg border border-[color:var(--brand-border)] bg-white px-3 text-sm">
          <option value="">Choose a project…</option>
          {(projectsQ.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <Button onClick={run} disabled={!projectId || running}>{running ? `Probing ${results.length}/${PROBE_TARGETS.length + 4}…` : "Run probe"}</Button>
        {results.length && !running ? (
          <Button
            variant="secondary"
            onClick={async () => {
              await navigator.clipboard.writeText(summarise(results));
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? "Copied" : "Copy summary (field names only)"}
          </Button>
        ) : null}
      </div>
      <ScanPanel client={client} projects={projectsQ.data ?? []} />
      {results.length ? (
        <div className="overflow-x-auto rounded-2xl border border-[color:var(--brand-border)] bg-white p-4 shadow-card">
          <table className="w-full min-w-[800px] text-xs">
            <thead className="text-left text-[color:var(--brand-muted)]">
              <tr>
                <th className="py-1.5 pr-3 font-medium">Area</th>
                <th className="py-1.5 pr-3 font-medium">Endpoint</th>
                <th className="py-1.5 pr-3 font-medium">Result</th>
                <th className="py-1.5 pr-3 text-right font-medium">Records</th>
                <th className="py-1.5 pr-3 text-right font-medium">ms</th>
                <th className="py-1.5 font-medium">Fields (share populated in sample)</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.id} className="border-t border-[color:var(--brand-border)] align-top">
                  <td className="py-2 pr-3">{r.group}</td>
                  <td className="py-2 pr-3">
                    <p className="font-medium">{r.label}</p>
                    <p className="break-all font-mono text-[10px] text-[color:var(--brand-muted)]">{r.path}</p>
                  </td>
                  <td className={`py-2 pr-3 font-semibold ${r.status === 200 ? "text-green-700" : "text-[color:var(--status-critical)]"}`}>
                    {r.status === 200 ? "OK" : `${r.status}`}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.total ?? r.count ?? "-"}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.ms}</td>
                  <td className="py-2">
                    {r.notes?.length ? (
                      <ul className="mb-1 list-disc pl-4">{r.notes.map((n) => <li key={n}>{n}</li>)}</ul>
                    ) : null}
                    {r.status === 200 ? (
                      <details>
                        <summary className="cursor-pointer">{r.coverage.filter((c) => c.share > 0).length} of {r.coverage.length} fields have data</summary>
                        <ul className="mt-1 columns-2 gap-4">
                          {r.coverage.map((c) => (
                            <li key={c.field} className={c.share ? "" : "text-[color:var(--brand-muted)]"}>
                              {c.field} <span className="tabular-nums">{Math.round(c.share * 100)}%</span>
                            </li>
                          ))}
                        </ul>
                        <pre className="mt-2 max-h-64 overflow-auto rounded bg-[color:var(--brand-canvas)] p-2 text-[10px]">{JSON.stringify(r.sample, null, 2)}</pre>
                      </details>
                    ) : (
                      <span className="text-[color:var(--brand-muted)]">{r.message}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

export default function ProbePage() {
  const { allowed, loading } = useCanProbe();
  if (loading) return <p className="text-sm">Loading…</p>;
  if (!allowed) return <p className="text-sm text-[color:var(--brand-muted)]">The data probe isn&apos;t available for your account.</p>;
  return (
    <Suspense fallback={<p className="text-sm">Loading…</p>}>
      <Probe />
    </Suspense>
  );
}
