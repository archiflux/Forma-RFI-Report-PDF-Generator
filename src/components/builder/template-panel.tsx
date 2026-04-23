"use client";

import { useEffect, useRef, useState } from "react";
import {
  downloadTemplate,
  importTemplate,
  TemplateImportError,
  templateStore,
} from "@/lib/report/template-store";
import type { ReportTemplate } from "@/lib/report/types";
import { Button } from "@/components/ui/button";

interface Props {
  projectId: string;
  template: ReportTemplate;
  onTemplateChange: (t: ReportTemplate) => void;
}

export function TemplatePanel({ projectId, template, onTemplateChange }: Props) {
  const [saved, setSaved] = useState<ReportTemplate[]>([]);
  const [importErr, setImportErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  function refresh() {
    setSaved(templateStore.list(projectId));
  }

  useEffect(refresh, [projectId]);

  function save() {
    templateStore.save(projectId, template);
    refresh();
  }

  function load(t: ReportTemplate) {
    onTemplateChange(t);
  }

  function remove(id: string) {
    templateStore.remove(projectId, id);
    refresh();
  }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const t = importTemplate(text);
      onTemplateChange(t);
      setImportErr(null);
    } catch (err) {
      setImportErr(
        err instanceof TemplateImportError ? err.message : "Failed to import template.",
      );
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-neutral-200">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={template.name}
          onChange={(e) => onTemplateChange({ ...template, name: e.target.value })}
          className="flex-1 rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium"
          placeholder="Template name"
        />
        <Button size="sm" onClick={save}>
          Save
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => downloadTemplate(template)}
        >
          Export
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => fileRef.current?.click()}
        >
          Import
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          onChange={onImportFile}
          className="hidden"
        />
      </div>

      {importErr ? (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {importErr}
        </p>
      ) : null}

      {saved.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">
            Saved templates for this project
          </p>
          <ul className="mt-2 space-y-1">
            {saved.map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-2 rounded-md border border-neutral-200 px-2 py-1 text-sm"
              >
                <span className="flex-1 truncate">{t.name}</span>
                <button
                  type="button"
                  onClick={() => load(t)}
                  className="text-xs text-[color:var(--brand-primary)] hover:underline"
                >
                  Load
                </button>
                <button
                  type="button"
                  onClick={() => remove(t.id)}
                  aria-label={`Delete ${t.name}`}
                  className="text-xs text-red-500 hover:underline"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
