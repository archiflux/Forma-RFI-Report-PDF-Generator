"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { beginSignIn } from "@/lib/aps/auth";
import { useAuth } from "@/lib/auth/store";
import { withBase } from "@/lib/base-path";
import { SiteboardMark } from "@/components/ui/siteboard-mark";

export default function LandingPage() {
  const router = useRouter();
  const accessToken = useAuth((s) => s.getAccessToken());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ensureFreshToken = useAuth((s) => s.ensureFreshToken);
  // Remembered session (closed tab, new day)? Go straight in.
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    if (accessToken) {
      router.replace("/templates");
      return;
    }
    let live = true;
    ensureFreshToken()
      .then((t) => {
        if (t && live) router.replace("/templates");
      })
      .finally(() => {
        if (live) setChecking(false);
      });
    return () => {
      live = false;
    };
  }, [accessToken, ensureFreshToken, router]);

  async function onSignIn() {
    setError(null);
    setBusy(true);
    try {
      await beginSignIn("/templates");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col border-t-4 border-[color:var(--bp-citron)] md:flex-row">
      {/* Brand panel (Holdpoint sign-in): teal-deep ground, mark, wordmark. */}
      <section className="relative flex flex-col justify-between bg-[color:var(--bp-teal-deep)] px-8 py-10 text-white md:w-[44%] md:px-12 md:py-14">
        <div className="flex items-center gap-3 font-display text-lg font-semibold uppercase leading-7 tracking-[0.12em] text-white">
          <span className="flex h-11 w-11 items-center justify-center bg-white">
            <SiteboardMark size={34} />
          </span>
          Siteboard
        </div>
        <div className="mt-12 md:mt-0">
          <h1 className="font-display text-4xl font-semibold leading-[1.1] tracking-[0.01em] text-white sm:text-5xl">
            <span className="sr-only">Bailey Partnership Siteboard. </span>
            <span className="text-[color:var(--bp-citron)]">Keep</span> your projects in sight
          </h1>
          <p className="mt-4 max-w-md text-base leading-6 text-white/75">
            Issues, RFIs, Forms and Reviews across your Autodesk Forma projects, as live dashboards, branded PDF reports and shareable snapshots.
          </p>
        </div>
        <p className="mt-12 text-xs text-white/55 md:mt-0">Bailey Partnership</p>
      </section>

      <section className="flex flex-1 items-center bg-[color:var(--bp-desk)] px-6 py-12 md:px-12">
        <div className="sb-enter relative w-full max-w-md border-t-[6px] border-[color:var(--bp-teal)] bg-white p-6 shadow-hp-xl sm:p-8">
          <Image
            src={withBase("/bailey-partnership-logo.png")}
            alt="Bailey Partnership"
            width={180}
            height={43}
            priority
            className="h-9 w-auto"
          />
          <p className="bp-label mt-6">Sign in</p>
          <h2 className="mt-1 font-display text-2xl font-semibold leading-8 text-[color:var(--bp-ink)]">Use your Autodesk account</h2>
          <p className="mt-3 text-sm text-[color:var(--slate-600)]">
            Siteboard is read-only: it cannot create, change or delete anything in Forma.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button size="lg" onClick={onSignIn} disabled={busy || checking}>
              {checking ? <SiteboardMark size={18} loading className="[&_rect:first-child]:stroke-white" /> : null}
              {busy ? "Redirecting…" : checking ? "Checking sign-in…" : "Sign in with Autodesk"}
            </Button>
          </div>
          {error ? (
            <p role="alert" className="mt-4 border-l-4 border-[color:var(--hold)] bg-white px-3 py-2 text-sm text-[color:var(--hold)] shadow-hp-sm">
              {error}
            </p>
          ) : null}
          <p className="mt-6 text-xs text-[color:var(--slate-600)]">
            No API keys are stored. Sign-in uses Autodesk&apos;s OAuth (3-legged PKCE): your Autodesk password goes to Autodesk, never to this app.{" "}
            <a
              href="https://aps.autodesk.com/en/docs/oauth/v2/tutorials/get-3-legged-token-pkce"
              className="font-semibold text-[color:var(--bp-teal)] underline-offset-4 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              About APS sign-in
            </a>
          </p>
        </div>
      </section>
    </main>
  );
}
