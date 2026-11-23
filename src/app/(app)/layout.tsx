"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense } from "react";
import { useCanProbe } from "@/lib/auth/use-can-probe";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/store";
import { withBase } from "@/lib/base-path";
import { SiteboardMark } from "@/components/ui/siteboard-mark";

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
        <p className="flex items-center gap-3 text-sm text-[color:var(--slate-600)]">
          <SiteboardMark size={28} loading />
          Checking your session…
        </p>
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Holdpoint app header: 4px citron rule, white at 90% with a blur. */}
      <header className="sticky top-0 z-20 border-t-4 border-[color:var(--bp-citron)] bg-white/90 shadow-hp-sm backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-screen-2xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6 lg:px-10">
          <Suspense fallback={<Brand href="/templates" />}>
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

// Main navigation. Dashboards cover every hub the user can access.
function HubNav() {
  const { allowed: canProbe } = useCanProbe();
  const pathname = usePathname() ?? "";
  const links = [
    ["Templates", "/templates"],
    ["Issues", "/dashboard"],
    ["Forms", "/forms-dashboard"],
    ["Reviews", "/reviews-dashboard"],
    ["RFIs", "/rfis-dashboard"],
    ["Guide", "/guide"],
    // Submittals is hidden until a project uses it; see templates.ts.
    ...(canProbe ? ([["Data probe", "/hubs"]] as const) : []),
  ] as const;
  return (
    <nav className="ml-auto hidden h-full items-stretch gap-1 text-sm md:flex">
      {links.map(([label, href]) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`relative px-3 py-2 font-semibold transition-colors duration-150 ${
              active ? "text-[color:var(--bp-teal)]" : "text-[color:var(--slate-700)] hover:bg-[color:var(--bp-desk)] hover:text-[color:var(--bp-teal)]"
            }`}
          >
            {label}
            {active ? <span className="absolute inset-x-3 bottom-0 h-[3px] bg-[color:var(--bp-citron)]" aria-hidden /> : null}
          </Link>
        );
      })}
    </nav>
  );
}

// Bailey Partnership logo, a hairline, then the Siteboard mark and
// wordmark (the wordmark text hides on phones to keep the header on one line).
function Brand({ href }: { href: string }) {
  return (
    <Link href={href} className="flex items-center gap-3.5" title="Back to dashboard templates">
      <Image
        src={withBase("/bailey-partnership-logo.png")}
        alt="Bailey Partnership"
        width={125}
        height={30}
        priority
        className="h-[26px] w-auto sm:h-[30px]"
      />
      <span className="h-[26px] w-px bg-[color:var(--bp-rule)]" aria-hidden />
      <span className="inline-flex items-center gap-2 font-display text-lg font-semibold uppercase leading-7 tracking-[0.12em] text-[color:var(--bp-teal)]">
        <SiteboardMark size={22} />
        <span className="hidden sm:inline">Siteboard</span>
      </span>
    </Link>
  );
}

// Logo returns to the template catalogue.
function HomeLink() {
  return <Brand href="/templates" />;
}
