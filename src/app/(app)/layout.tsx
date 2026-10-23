"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
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
          <Suspense fallback={<Brand href="/hubs" />}>
            <HomeLink />
          </Suspense>
          <Suspense fallback={null}>
            <HubNav />
          </Suspense>
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

// Hub-scoped navigation. Only shown once a hub is in the URL.
function HubNav() {
  const hubId = useSearchParams().get("hubId");
  if (!hubId) return null;
  const q = `?hubId=${encodeURIComponent(hubId)}`;
  const links = [
    ["Templates", "/templates"],
    ["Issues", "/dashboard"],
    ["Forms", "/forms-dashboard"],
    ["Reviews", "/reviews-dashboard"],
    ["RFIs", "/rfis-dashboard"],
    ["Data probe", "/probe"],
  ] as const;
  return (
    <nav className="ml-auto hidden gap-4 text-sm md:flex">
      {links.map(([label, href]) => (
        <Link key={href} href={`${href}${q}`} className="font-medium text-[color:var(--brand-secondary)] hover:text-[color:var(--brand-primary)]">
          {label}
        </Link>
      ))}
    </nav>
  );
}

function Brand({ href }: { href: string }) {
  return (
    <Link href={href} className="flex items-center gap-3" title="Back to dashboard templates">
      <Image
        src="/icon-colour.png"
        alt="Bailey Partnership"
        width={36}
        height={36}
        priority
        className="h-9 w-9 rounded-md object-contain"
      />
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--brand-secondary)]">
          Bailey Partnership
        </p>
        <h1 className="text-base font-semibold text-[color:var(--brand-primary)] sm:text-lg">
          Forma Dashboards
        </h1>
      </div>
    </Link>
  );
}

// Logo returns to the template catalogue for the current hub, or to the hub
// picker when no hub is selected yet.
function HomeLink() {
  const hubId = useSearchParams().get("hubId");
  return <Brand href={hubId ? `/templates?hubId=${encodeURIComponent(hubId)}` : "/hubs"} />;
}
