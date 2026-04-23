"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { completeSignIn, consumeReturnTo } from "@/lib/aps/auth";
import { useAuth } from "@/lib/auth/store";

export default function AuthCallbackPage() {
  const router = useRouter();
  const setTokens = useAuth((s) => s.setTokens);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const params = new URLSearchParams(window.location.search);
    completeSignIn(params)
      .then((tokens) => {
        setTokens(tokens);
        const to = consumeReturnTo();
        router.replace(to);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
      });
  }, [router, setTokens]);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center px-6 py-16">
      <div className="w-full rounded-2xl bg-white p-8 shadow-sm ring-1 ring-neutral-200">
        {error ? (
          <>
            <h1 className="text-xl font-semibold text-red-700">Sign-in failed</h1>
            <p className="mt-2 text-sm text-neutral-600">{error}</p>
            <Link
              href="/"
              className="mt-4 inline-block text-sm text-[color:var(--brand-primary)] underline"
            >
              Try again
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold">Signing you in…</h1>
            <p className="mt-2 text-sm text-neutral-600">
              Completing the Autodesk OAuth handshake.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
