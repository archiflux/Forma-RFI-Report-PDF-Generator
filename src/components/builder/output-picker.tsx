"use client";

import type { OutputFormat, ReportTemplate } from "@/lib/report/types";
import { cn } from "@/lib/cn";

interface Props {
  template: ReportTemplate;
  onChange: (t: ReportTemplate) => void;
}

const FORMATS: { id: OutputFormat; label: string; hint: string }[] = [
  { id: "pdf", label: "PDF", hint: "Branded client-ready report" },
  { id: "csv", label: "CSV", hint: "Raw data for Excel / BI" },
];

type PageVariant = "A4-portrait" | "A4-landscape" | "A3-portrait" | "A3-landscape";

const PAGE_VARIANTS: { id: PageVariant; label: string }[] = [
  { id: "A4-portrait", label: "A4 portrait" },
  { id: "A4-landscape", label: "A4 landscape" },
  { id: "A3-portrait", label: "A3 portrait" },
  { id: "A3-landscape", label: "A3 landscape" },
];

function currentVariant(t: ReportTemplate): PageVariant {
  const size = t.pageSize === "A3" ? "A3" : "A4";
  const orient = t.orientation === "landscape" ? "landscape" : "portrait";
  return `${size}-${orient}` as PageVariant;
}

function setVariant(t: ReportTemplate, v: PageVariant): ReportTemplate {
  const [size, orient] = v.split("-") as ["A4" | "A3", "portrait" | "landscape"];
  return { ...t, pageSize: size, orientation: orient };
}

export function OutputPicker({ template, onChange }: Props) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-neutral-200">
      <h3 className="text-sm font-semibold">Output</h3>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {FORMATS.map((f) => {
          const on = template.output === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => onChange({ ...template, output: f.id })}
              className={cn(
                "rounded-lg border p-3 text-left transition",
                on
                  ? "border-[color:var(--brand-primary)] bg-[color:var(--brand-primary)]/5"
                  : "border-neutral-200 hover:border-neutral-300",
              )}
            >
              <p className="text-sm font-medium">{f.label}</p>
              <p className="mt-0.5 text-xs text-neutral-500">{f.hint}</p>
            </button>
          );
        })}
      </div>

      {template.output === "pdf" ? (
        <>
          <div className="mt-3">
            <label className="text-xs font-medium uppercase tracking-wider text-neutral-500">
              Layout
            </label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {(
                [
                  {
                    id: "table" as const,
                    label: "Table",
                    hint: "One row per RFI — like ACC's “Summary”",
                  },
                  {
                    id: "detail" as const,
                    label: "Detail",
                    hint: "One section per RFI — like ACC's “Detail”",
                  },
                ]
              ).map((l) => {
                const on = (template.pdfLayout ?? "table") === l.id;
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => onChange({ ...template, pdfLayout: l.id })}
                    className={cn(
                      "rounded-lg border p-2.5 text-left transition",
                      on
                        ? "border-[color:var(--brand-primary)] bg-[color:var(--brand-primary)]/5"
                        : "border-neutral-200 hover:border-neutral-300",
                    )}
                  >
                    <p className="text-sm font-medium">{l.label}</p>
                    <p className="mt-0.5 text-xs text-neutral-500">{l.hint}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {template.pdfLayout === "detail" ? (
            <label className="mt-3 flex items-start gap-2 text-xs text-neutral-700">
              <input
                type="checkbox"
                checked={template.detailIncludeComments ?? false}
                onChange={(e) =>
                  onChange({ ...template, detailIncludeComments: e.target.checked })
                }
                className="mt-0.5"
              />
              <span>
                Include comment history.{" "}
                <span className="text-neutral-500">
                  Requires loading full RFI detail with comments — adds a
                  request per RFI.
                </span>
              </span>
            </label>
          ) : null}

          <div className="mt-3">
            <label className="text-xs font-medium uppercase tracking-wider text-neutral-500">
              Page size
            </label>
            <select
              value={currentVariant(template)}
              onChange={(e) => onChange(setVariant(template, e.target.value as PageVariant))}
              className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1 text-sm"
            >
              {PAGE_VARIANTS.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-neutral-500">
              {template.pdfLayout === "detail"
                ? "Detail sections wrap to fit the chosen page."
                : "The table auto-fits the page width — choose landscape or A3 if you need more horizontal room for many columns."}
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}
