// Every column the Forms register can show; question answers become
// optional columns.

import { formUrl } from "@/lib/aps/links";
import { customKeys, type RegisterColumn } from "@/lib/layout/register";
import { formStatusLabel, isFormOverdue } from "./normalise";
import type { FormRecord } from "./types";

const day = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-GB") : "");
const num = (s: string) => {
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : s;
};

export const FORM_DEFAULT_SORT = { col: "formDate", dir: -1 } as const;

export function formColumns(forms: FormRecord[], now: Date): Array<RegisterColumn<FormRecord>> {
  const cols: Array<RegisterColumn<FormRecord>> = [
    { id: "project", label: "Project", value: (f) => f.projectName, width: 2, default: true },
    { id: "number", label: "#", value: (f) => f.formNum, sortValue: (f) => num(f.formNum), width: 0.6, default: true },
    { id: "name", label: "Name", value: (f) => f.name, href: (f) => formUrl(f.projectId, f.templateId, f.id), width: 3, default: true },
    { id: "template", label: "Template", value: (f) => f.templateName, width: 1.6, default: true },
    { id: "status", label: "Status", value: (f) => formStatusLabel(f.status), width: 1, default: true },
    { id: "createdBy", label: "Created by", value: (f) => f.createdBy ?? "", width: 1.4, default: true },
    { id: "formDate", label: "Form date", value: (f) => day(f.formDate), sortValue: (f) => f.formDate ?? "", width: 1, default: true },
    {
      id: "due",
      label: "Due",
      value: (f) => `${day(f.dueDate)}${isFormOverdue(f, now) ? " (overdue)" : ""}`,
      sortValue: (f) => f.dueDate ?? "",
      alert: (f) => isFormOverdue(f, now),
      width: 1.2,
      default: true,
    },
    { id: "created", label: "Created", value: (f) => day(f.createdAt), sortValue: (f) => f.createdAt, width: 1 },
    { id: "updated", label: "Last updated", value: (f) => day(f.updatedAt), sortValue: (f) => f.updatedAt ?? "", width: 1 },
    { id: "templateType", label: "Template type", value: (f) => f.templateType ?? "", width: 1.2 },
  ];
  for (const k of customKeys(forms.map((f) => f.custom))) {
    cols.push({ id: `custom:${k}`, label: k, value: (f) => f.custom?.[k] ?? "", width: 1.2 });
  }
  return cols;
}
