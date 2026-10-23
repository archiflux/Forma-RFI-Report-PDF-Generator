"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/store";
import { deleteShare, listMyShares, publishSnapshot, shareUrl } from "@/lib/share/client";
import { EXPIRY_DAYS, type SnapshotKind, type SnapshotMeta } from "@/lib/share/types";

// Publishes the current dashboard data as a hosted snapshot anyone with the
// link can open (no sign-in) until it expires, and lists the user's links.
export function SharePanel({
  kind,
  itemCount,
  defaultTitle,
  buildData,
  redactionNote,
}: {
  kind: SnapshotKind;
  itemCount: number;
  defaultTitle: string;
  buildData: (redacted: boolean) => unknown;
  redactionNote: string;
}) {
  const ensureFreshToken = useAuth((s) => s.ensureFreshToken);
  const [title, setTitle] = useState("");
  const [redacted, setRedacted] = useState(true);
  const [days, setDays] = useState<number>(30);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mine, setMine] = useState<SnapshotMeta[] | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const token = await ensureFreshToken();
    if (!token) return;
    try {
      setMine(await listMyShares(token));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, [ensureFreshToken]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function copy(id: string) {
    await navigator.clipboard.writeText(shareUrl(id)).catch(() => undefined);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <details className="rounded-2xl border border-[color:var(--brand-border)] bg-white p-4 shadow-card">
      <summary className="cursor-pointer text-sm font-semibold text-[color:var(--brand-primary)]">
        Share a link (no Forma sign-in needed to view)
      </summary>
      <div className="mt-3 space-y-2 text-xs">
        <p className="text-[color:var(--brand-muted)]">
          Publishes the {itemCount} loaded records as they are now. The link does not update itself and stops working when it expires.
        </p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={defaultTitle}
          className="min-h-8 w-full max-w-md rounded-lg border border-[color:var(--brand-border)] px-2"
        />
        <label className="flex items-start gap-2">
          <input type="checkbox" className="mt-0.5" checked={redacted} onChange={(e) => setRedacted(e.target.checked)} />
          <span>
            Redact: {redactionNote}
            {!redacted ? <strong className="block text-[color:var(--status-critical)]">Names and full details will be visible to anyone with the link.</strong> : null}
          </span>
        </label>
        <label className="flex items-center gap-2">
          Expires after
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded border border-[color:var(--brand-border)] px-1 py-0.5">
            {EXPIRY_DAYS.map((d) => (
              <option key={d} value={d}>{d} days</option>
            ))}
          </select>
        </label>
        <Button
          size="sm"
          disabled={busy || itemCount === 0}
          onClick={async () => {
            setBusy(true);
            setErr(null);
            try {
              const token = await ensureFreshToken();
              if (!token) throw new Error("Your session has expired. Sign in again.");
              const meta = await publishSnapshot(token, {
                kind,
                title: title.trim() || defaultTitle,
                redacted,
                expiresInDays: days,
                itemCount,
                data: buildData(redacted),
              });
              await copy(meta.id);
              await refresh();
            } catch (e) {
              setErr(e instanceof Error ? e.message : String(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Publishing…" : "Create link"}
        </Button>
        {err ? <p className="text-red-600">{err}</p> : null}

        {mine && mine.length ? (
          <div className="pt-2">
            <p className="font-semibold text-[color:var(--brand-primary)]">My shared links</p>
            <ul className="mt-1 divide-y divide-[color:var(--brand-border)]">
              {mine.map((m) => {
                const expired = m.expiresAt < new Date().toISOString();
                return (
                  <li key={m.id} className="flex flex-wrap items-center gap-2 py-1.5">
                    <a href={`/view?s=${m.id}`} target="_blank" rel="noreferrer" className="font-medium underline">{m.title}</a>
                    <span className="text-[color:var(--brand-muted)]">
                      {m.kind}, {m.itemCount} records, {m.redacted ? "redacted" : "not redacted"}, {expired ? "expired" : `expires ${new Date(m.expiresAt).toLocaleDateString("en-GB")}`}
                    </span>
                    <button type="button" className="ml-auto underline" onClick={() => copy(m.id)}>{copied === m.id ? "Copied" : "Copy link"}</button>
                    <button
                      type="button"
                      className="text-[color:var(--status-critical)] underline"
                      onClick={async () => {
                        const token = await ensureFreshToken();
                        if (!token) return;
                        await deleteShare(token, m.id).catch((e: unknown) => setErr(String(e)));
                        await refresh();
                      }}
                    >
                      Delete
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </details>
  );
}
