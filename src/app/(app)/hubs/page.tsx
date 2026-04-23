"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useApsClient } from "@/lib/aps/use-client";
import { listHubs } from "@/lib/aps/hubs";

export default function HubsPage() {
  const client = useApsClient();
  const q = useQuery({
    queryKey: ["hubs"],
    queryFn: () => listHubs(client),
  });

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
        <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(q.data ?? []).map((hub) => (
            <li key={hub.id}>
              <Link
                href={`/projects?hubId=${encodeURIComponent(hub.id)}`}
                className="block rounded-xl bg-white p-5 shadow-sm ring-1 ring-neutral-200 transition hover:ring-[color:var(--brand-primary)]"
              >
                <p className="font-medium">{hub.name}</p>
                <p className="mt-1 text-xs text-neutral-500">
                  {hub.region ?? "—"} · {hub.extensionType ?? ""}
                </p>
              </Link>
            </li>
          ))}
          {q.data?.length === 0 ? (
            <p className="text-sm text-neutral-500">
              Your account has no Forma hubs. Ask a hub admin to add you.
            </p>
          ) : null}
        </ul>
      )}
    </section>
  );
}
