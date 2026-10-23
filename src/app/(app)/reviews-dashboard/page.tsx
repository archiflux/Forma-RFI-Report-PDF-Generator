"use client";

import { Suspense } from "react";
import { GenericPage } from "@/components/generic/generic-page";
import { loadReviews, reviewsConfig } from "@/lib/reviews/config";

export default function ReviewsDashboardPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[color:var(--brand-muted)]">Loading…</p>}>
      <GenericPage cfg={reviewsConfig} loader={loadReviews} intro="Document reviews" />
    </Suspense>
  );
}
