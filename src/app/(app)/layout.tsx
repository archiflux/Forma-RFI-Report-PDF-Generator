"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/store";

export default function AuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const tokens = useAuth((s) => s.tokens);
  const ensureFreshToken = useAuth((s) => s.ensureFreshToken);
  const signOut = useAuth((s) => s.signOut);

  useEffect(() => {
    if (tokens) return;
    ensureFreshToken().then((t) => {
      if (!t) router.replace("/");
    });
  }, [tokens, ensureFreshToken, router]);

  if (!tokens) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl items-center px-6 py-16">
        <p className="text-sm text-neutral-500">Checking your session…</p>
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-[color:var(--brand-border)] bg-white/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-screen-2xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-10">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="hidden h-9 w-1.5 rounded-full bg-[color:var(--brand-accent)] sm:inline-block"
            />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--brand-secondary)]">
                Bailey Partnership
              </p>
              <h1 className="text-base font-semibold text-[color:var(--brand-primary)] sm:text-lg">
                Forma RFI Reports
              </h1>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await signOut();
              router.replace("/");
            }}
          >
            Sign out
          </Button>
        </div>
      </header>
      <div className="mx-auto w-full max-w-screen-2xl px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
        {children}
      </div>
    </div>
  );
}
