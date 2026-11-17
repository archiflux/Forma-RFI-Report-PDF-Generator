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
  // Forma location the form is linked to, as a path ("Site > Unit 1").
  location?: string;
  // UK postcode found in the location, the form's name or its answers;
  // used to pin the form on the map.
  postcode?: string;
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
