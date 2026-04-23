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
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
      <div className="rounded-2xl bg-white p-10 shadow-sm ring-1 ring-neutral-200">
        <p className="text-sm font-medium uppercase tracking-wider text-[color:var(--brand-accent)]">
          Bailey Partnership
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-[color:var(--brand-ink)]">
          Forma RFI Report Generator
        </h1>
        <p className="mt-4 max-w-prose text-neutral-600">
          Sign in with your Autodesk account to generate branded PDF or CSV RFI
          reports from Autodesk Forma (formerly Autodesk Construction Cloud).
          This app is <strong>read-only</strong> — it cannot create, edit, or
          delete anything in Forma.
        </p>

        <div className="mt-8 flex items-center gap-3">
          <Button size="lg" onClick={onSignIn} disabled={busy}>
            {busy ? "Redirecting…" : "Sign in with Autodesk"}
          </Button>
          <a
            href="https://aps.autodesk.com/en/docs/oauth/v2/tutorials/get-3-legged-token-pkce"
            className="text-sm text-neutral-500 underline hover:text-neutral-700"
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

      <p className="mt-6 text-xs text-neutral-500">
        No API keys are stored. Sign-in uses OAuth 3-legged PKCE — your
        Autodesk credentials go directly to Autodesk, never to this app.
      </p>
    </main>
  );
}
