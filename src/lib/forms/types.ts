export interface FormRecord {
  key: string;
  id: string;
  projectId: string;
  projectName: string;
  formNum: string;
  name: string;
  status: string;
  templateId: string;
  templateName: string;
  templateType?: string;
  formDate?: string;
  dueDate?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt?: string;
  // Answers to the template's questions: question label -> answer text.
  custom?: Record<string, string>;
}

export interface FormsProject {
  id: string;
  name: string;
  formCount: number;
  formsUnavailable?: boolean;
  error?: string;
}

export interface FormsDataset {
  projects: FormsProject[];
  forms: FormRecord[];
}
