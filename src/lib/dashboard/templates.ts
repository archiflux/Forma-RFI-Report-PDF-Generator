// Dashboard template catalogue, modelled on the Forma Insight "Power BI
// Templates" page. `href` builds the route for a hub; templates without one
// are planned and list the probe areas that decide whether they're viable.

export type TemplateStatus = "live" | "report" | "planned";

export interface DashboardTemplate {
  id: string;
  title: string;
  description: string;
  scope: Array<"Project" | "Hub">;
  status: TemplateStatus;
  probeAreas: string[];
  href?: (hubId: string) => string;
}

export const TEMPLATES: DashboardTemplate[] = [
  {
    id: "issues",
    title: "Issues Dashboard",
    description: "BCF issue workflow across any set of projects: status, overdue, ageing, type, root cause and assignee workload. Shareable as a redacted snapshot.",
    scope: ["Project", "Hub"],
    status: "live",
    probeAreas: ["Issues (BCF)"],
    href: (h) => `/dashboard?hubId=${encodeURIComponent(h)}`,
  },
  {
    id: "rfis",
    title: "RFI Report",
    description: "Field-level RFI reports with custom attributes, exported as branded PDF or CSV. One project at a time.",
    scope: ["Project"],
    status: "report",
    probeAreas: ["RFIs"],
    href: (h) => `/projects?hubId=${encodeURIComponent(h)}`,
  },
  { id: "forms", title: "Forms Dashboard", description: "Form completion and overdue forms by template and project.", scope: ["Project", "Hub"], status: "planned", probeAreas: ["Forms"] },
  { id: "assets", title: "Assets Dashboard", description: "Asset registers and commissioning progress by category and status.", scope: ["Project", "Hub"], status: "planned", probeAreas: ["Assets"] },
  { id: "reviews", title: "Reviews Dashboard", description: "Document review throughput, approvals and rejections.", scope: ["Project", "Hub"], status: "planned", probeAreas: ["Reviews"] },
  { id: "submittals", title: "Submittals Dashboard", description: "Submittal items by status, ball in court and due date.", scope: ["Project", "Hub"], status: "planned", probeAreas: ["Submittals"] },
  { id: "photos", title: "Photos Dashboard", description: "Photo capture over time, by type and location.", scope: ["Project", "Hub"], status: "planned", probeAreas: ["Photos"] },
  { id: "model-coordination", title: "Model Coordination", description: "Clash groups and model set coverage.", scope: ["Project"], status: "planned", probeAreas: ["Model coordination"] },
];
