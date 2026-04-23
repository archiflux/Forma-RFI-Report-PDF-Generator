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
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-neutral-500">
              Page size
            </label>
            <select
              value={template.pageSize ?? "A4"}
              onChange={(e) =>
                onChange({ ...template, pageSize: e.target.value as "A4" | "Letter" })
              }
              className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1 text-sm"
            >
              <option value="A4">A4</option>
              <option value="Letter">Letter</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-neutral-500">
              Orientation
            </label>
            <select
              value={template.orientation ?? "portrait"}
              onChange={(e) =>
                onChange({
                  ...template,
                  orientation: e.target.value as "portrait" | "landscape",
                })
              }
              className="mt-1 w-full rounded-md border border-neutral-300 px-2 py-1 text-sm"
            >
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </div>
        </div>
      ) : null}
    </div>
  );
}
