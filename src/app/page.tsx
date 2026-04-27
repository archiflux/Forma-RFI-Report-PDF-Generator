"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { beginSignIn } from "@/lib/aps/auth";
import { useAuth } from "@/lib/auth/store";

export default function LandingPage() {
  const router = useRouter();
  const accessToken = useAuth((s) => s.getAccessToken());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (accessToken) router.replace("/hubs");
  }, [accessToken, router]);

  async function onSignIn() {
    setError(null);
    setBusy(true);
    try {
      await beginSignIn("/hubs");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-6 py-16">
      <div className="relative overflow-hidden rounded-3xl border border-[color:var(--brand-border)] bg-white p-8 shadow-card sm:p-10">
        <span
          aria-hidden
          className="absolute right-0 top-0 h-full w-1.5 bg-[color:var(--brand-accent)]"
        />
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--brand-secondary)]">
          Bailey Partnership
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-[color:var(--brand-primary)] sm:text-4xl">
          Forma RFI Report Generator
        </h1>
        <p className="mt-4 max-w-prose text-[color:var(--brand-ink-soft)]">
          Sign in with your Autodesk account to generate branded PDF or CSV RFI
          reports from Autodesk Forma (formerly Autodesk Construction Cloud).
          This app is <strong>read-only</strong> — it cannot create, edit, or
          delete anything in Forma.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button size="lg" onClick={onSignIn} disabled={busy}>
            {busy ? "Redirecting…" : "Sign in with Autodesk"}
          </Button>
          <a
            href="https://aps.autodesk.com/en/docs/oauth/v2/tutorials/get-3-legged-token-pkce"
            className="text-sm font-medium text-[color:var(--brand-secondary)] underline-offset-4 hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            Learn about APS sign-in
          </a>
        </div>

        {error ? (
          <p role="alert" className="mt-4 text-sm text-red-600">
            {error}
          </p>
        ) : null}
      </div>

      <p className="mt-6 text-xs text-[color:var(--brand-muted)]">
        No API keys are stored. Sign-in uses OAuth 3-legged PKCE — your
        Autodesk credentials go directly to Autodesk, never to this app.
      </p>
    </main>
  );
}
