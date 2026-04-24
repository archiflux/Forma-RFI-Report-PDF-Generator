"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApsClient } from "@/lib/aps/use-client";
import { listHubs } from "@/lib/aps/hubs";
import { loadPublicConfig } from "@/lib/aps/config";
import type { Hub, HubKind } from "@/lib/aps/types";

const KIND_LABEL: Record<HubKind, string> = {
  acc: "Forma / ACC hub",
  personal: "Personal Autodesk hub",
  unknown: "Other hub",
};

const KIND_HINT: Record<HubKind, string | null> = {
  acc: null,
  personal:
    "Personal hubs don't contain ACC RFIs — this is typically a Fusion 360 hub.",
  unknown: "Unrecognised hub type; RFIs may not be available.",
};

const KIND_ORDER: HubKind[] = ["acc", "unknown", "personal"];

function groupByKind(hubs: Hub[]): Record<HubKind, Hub[]> {
  const out: Record<HubKind, Hub[]> = { acc: [], personal: [], unknown: [] };
  for (const h of hubs) out[h.kind].push(h);
  return out;
}

export default function HubsPage() {
  const client = useApsClient();
  const q = useQuery({
    queryKey: ["hubs"],
    queryFn: () => listHubs(client),
  });

  const groups = useMemo(() => (q.data ? groupByKind(q.data) : null), [q.data]);
  const noAccHubs = groups !== null && groups.acc.length === 0;

  return (
    <section>
      <h2 className="text-xl font-semibold">Choose a hub</h2>
      <p className="mt-1 text-sm text-neutral-600">
        Pick the Forma hub (account) you want to pull RFIs from.
      </p>

      {q.isLoading ? (
        <p className="mt-6 text-sm text-neutral-500">Loading hubs…</p>
      ) : q.isError ? (
        <p className="mt-6 text-sm text-red-600">
          {q.error instanceof Error ? q.error.message : String(q.error)}
        </p>
      ) : (
        <>
          {noAccHubs ? <NoAccHubsPanel /> : null}

          {groups
            ? KIND_ORDER.filter((k) => groups[k].length > 0).map((kind) => (
                <HubGroup key={kind} kind={kind} hubs={groups[kind]} />
              ))
            : null}

          {q.data?.length === 0 ? (
            <p className="mt-6 text-sm text-neutral-500">
              Your Autodesk account isn&apos;t a member of any hubs.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

function HubGroup({ kind, hubs }: { kind: HubKind; hubs: Hub[] }) {
  const hint = KIND_HINT[kind];
  return (
    <div className="mt-6">
      <h3 className="text-xs font-medium uppercase tracking-wider text-neutral-500">
        {KIND_LABEL[kind]} · {hubs.length}
      </h3>
      {hint ? <p className="mt-1 text-xs text-neutral-500">{hint}</p> : null}

      <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {hubs.map((hub) => (
          <li key={hub.id}>
            <Link
              href={`/projects?hubId=${encodeURIComponent(hub.id)}`}
              aria-disabled={kind === "personal"}
              className={
                kind === "acc"
                  ? "block rounded-xl bg-white p-5 shadow-sm ring-1 ring-neutral-200 transition hover:ring-[color:var(--brand-primary)]"
                  : "block rounded-xl bg-neutral-50 p-5 ring-1 ring-neutral-200"
              }
            >
              <p className="font-medium">{hub.name}</p>
              <p className="mt-1 text-xs text-neutral-500">
                {hub.region ?? "—"}
                {hub.extensionType ? ` · ${hub.extensionType}` : ""}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NoAccHubsPanel() {
  const cfg = loadPublicConfig();
  const [copied, setCopied] = useState(false);

  async function copyClientId() {
    try {
      await navigator.clipboard.writeText(cfg.clientId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be unavailable (insecure context / older Safari);
      // user can always copy by hand.
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
      <h3 className="text-sm font-semibold text-amber-900">
        No Forma / ACC hubs found for this account
      </h3>
      <p className="mt-2 text-sm text-amber-900">
        This usually means one of two things:
      </p>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-amber-900">
        <li>
          <strong>You&apos;re signed in with the wrong Autodesk account.</strong>{" "}
          Click <em>Sign out</em> above, also sign out of{" "}
          <a
            href="https://accounts.autodesk.com"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            accounts.autodesk.com
          </a>
          , then sign back in with the email that&apos;s a member of the Forma
          hub (usually your work email).
        </li>
        <li>
          <strong>
            Your hub admin hasn&apos;t approved this app&apos;s Client ID yet.
          </strong>{" "}
          ACC/Forma hubs require each APS app to be explicitly allow-listed.
          Ask a hub admin to go to{" "}
          <em>Account Admin → Integrations → Custom Integrations → Add</em>,
          paste the Client ID below, and save. Until that&apos;s done, the hub will
          be invisible to this app even if you have access to it in the Forma
          web UI.
        </li>
      </ol>
      <div className="mt-4 flex items-center gap-2">
        <code className="flex-1 truncate rounded-md bg-white px-3 py-2 text-xs text-neutral-800 ring-1 ring-amber-200">
          {cfg.clientId || "(Client ID not configured)"}
        </code>
        <button
          type="button"
          onClick={copyClientId}
          disabled={!cfg.clientId}
          className="rounded-md bg-amber-900 px-3 py-2 text-xs font-medium text-white hover:bg-amber-800 disabled:opacity-50"
        >
          {copied ? "Copied!" : "Copy Client ID"}
        </button>
      </div>
    </div>
  );
}
