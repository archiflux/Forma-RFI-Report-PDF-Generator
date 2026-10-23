import { z } from "zod";
import type { FormsDataset } from "./types";

// Replace people's names with Person 1, Person 2... consistently.
export function redactForms(ds: FormsDataset): FormsDataset {
  const aliases = new Map<string, string>();
  const alias = (n: string) => {
    if (!aliases.has(n)) aliases.set(n, `Person ${aliases.size + 1}`);
    return aliases.get(n) as string;
  };
  return {
    projects: ds.projects.filter((p) => !p.error && !p.formsUnavailable).map(({ id, name, formCount }) => ({ id, name, formCount })),
    forms: ds.forms.map((f) => (f.createdBy ? { ...f, createdBy: alias(f.createdBy) } : f)),
  };
}

const FormSchema = z.object({
  key: z.string(),
  id: z.string(),
  projectId: z.string(),
  projectName: z.string(),
  formNum: z.string(),
  name: z.string(),
  status: z.string(),
  templateId: z.string(),
  templateName: z.string(),
  templateType: z.string().optional(),
  formDate: z.string().optional(),
  dueDate: z.string().optional(),
  createdBy: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
});

const DatasetSchema = z.object({
  projects: z.array(z.object({ id: z.string(), name: z.string(), formCount: z.number() })),
  forms: z.array(FormSchema),
});

export function parseFormsDataset(json: unknown): FormsDataset {
  return DatasetSchema.parse(json) as FormsDataset;
}
