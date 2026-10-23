"use client";

import { Suspense } from "react";
import { GenericPage } from "@/components/generic/generic-page";
import { loadSubmittals, submittalsConfig } from "@/lib/submittals/config";

export default function SubmittalsDashboardPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[color:var(--brand-muted)]">Loading…</p>}>
      <GenericPage cfg={submittalsConfig} loader={loadSubmittals} intro="Submittal items" />
    </Suspense>
  );
}
