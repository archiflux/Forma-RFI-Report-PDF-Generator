"use client";

import { Suspense } from "react";
import { GenericPage } from "@/components/generic/generic-page";
import { loadRfis, rfisConfig } from "@/lib/rfis-dash/config";

export default function RfisDashboardPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[color:var(--brand-muted)]">Loading…</p>}>
      <GenericPage
        cfg={rfisConfig}
        loader={loadRfis}
        intro="Requests for information"
        enrich={{
          label: "Load custom fields",
          note: "Autodesk's RFI list leaves out custom fields, so this fetches each RFI individually. Expect about a minute per 500 RFIs.",
        }}
      />
    </Suspense>
  );
}
