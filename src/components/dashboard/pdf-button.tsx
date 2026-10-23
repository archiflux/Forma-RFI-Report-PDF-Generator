"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { registerCsv, type DashboardReport } from "@/lib/report/dashboard/model";
import { downloadBlob, safeFilename } from "@/lib/report/export/download";
import { loadLogoDataUri } from "@/lib/report/export/logo";

// Renders the dashboard as currently filtered to a branded A4 landscape PDF,
// or its register to CSV. The PDF renderer is imported on click so it stays
// out of the page bundle. `build(includeRegister, maxRegisterRows)`.
export function PdfButton({ build }: { build: (includeRegister: boolean, maxRegisterRows?: number) => DashboardReport }) {
  const [busy, setBusy] = useState(false);
  const [register, setRegister] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-1.5 text-xs">
        <input type="checkbox" checked={register} onChange={(e) => setRegister(e.target.checked)} />
        Include register
      </label>
      <Button
        size="sm"
        variant="secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setErr(null);
          try {
            const report = build(register);
            const [{ buildDashboardPdf }, logo] = await Promise.all([import("@/lib/report/dashboard/pdf"), loadLogoDataUri()]);
            downloadBlob(await buildDashboardPdf(report, logo), safeFilename(report.title, "pdf"));
          } catch (e) {
            setErr(e instanceof Error ? e.message : String(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Building PDF…" : "Download PDF report"}
      </Button>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => {
          const report = build(true, Infinity);
          const csv = registerCsv(report);
          if (csv) downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), safeFilename(report.title, "csv"));
        }}
      >
        Download CSV
      </Button>
      {err ? <span className="text-xs text-red-600">{err}</span> : null}
    </div>
  );
}
