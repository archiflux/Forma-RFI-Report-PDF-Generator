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
      <header className="sticky top-0 z-20 border-b border-[color:var(--brand-border)] bg-white/80 backdrop-blur-md">
        <div className="h-[3px]" style={{ background: "var(--brand-gradient)" }} aria-hidden />
        <div className="mx-auto flex w-full max-w-screen-2xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-10">
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
        <PageFade>{children}</PageFade>
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
    // Submittals is hidden until a project uses it; see templates.ts.
    ...(canProbe ? ([["Data probe", "/hubs"]] as const) : []),
  ] as const;
  return (
    <nav className="ml-auto hidden gap-1 text-sm md:flex">
      {links.map(([label, href]) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`relative rounded-full px-3 py-1.5 font-medium transition-colors duration-200 ${
              active
                ? "bg-[color:var(--brand-teal)] text-white shadow-[0_6px_16px_-8px_rgba(0,104,129,0.8)]"
                : "text-[color:var(--brand-secondary)] hover:bg-[color:var(--brand-teal-soft)] hover:text-[color:var(--brand-teal)]"
            }`}
          >
            {label}
            {active ? <span className="absolute inset-x-3 -bottom-[3px] h-[3px] rounded-full bg-[#d1c800]" aria-hidden /> : null}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand({ href }: { href: string }) {
  return (
    <Link href={href} className="flex items-center gap-3" title="Back to dashboard templates">
      <Image
        src={withBase("/icon-colour.png")}
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
        <h1 className="font-wordmark text-lg font-semibold tracking-wide text-[color:var(--brand-primary)] sm:text-xl">
          Siteboard
        </h1>
      </div>
    </Link>
  );
}

// Logo returns to the template catalogue.
function HomeLink() {
  return <Brand href="/templates" />;
}

// Each page fades up as you move between dashboards.
function PageFade({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="sb-enter">
      {children}
    </div>
  );
}
