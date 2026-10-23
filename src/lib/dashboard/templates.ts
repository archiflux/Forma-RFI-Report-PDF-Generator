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
    id: "rfi-dashboard",
    title: "RFI Dashboard",
    description: "RFIs across any set of projects: open and overdue responses, ball in court, discipline and priority, and time to respond and close.",
    scope: ["Project", "Hub"],
    status: "live",
    probeAreas: ["RFIs"],
    href: (h) => `/rfis-dashboard?hubId=${encodeURIComponent(h)}`,
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
  {
    id: "forms",
    title: "Forms Dashboard",
    description: "Forms across any set of projects: open and overdue forms, monthly volume, and breakdowns by template, status, project and creator.",
    scope: ["Project", "Hub"],
    status: "live",
    probeAreas: ["Forms"],
    href: (h) => `/forms-dashboard?hubId=${encodeURIComponent(h)}`,
  },
  { id: "assets", title: "Assets Dashboard", description: "Asset registers and commissioning progress by category and status.", scope: ["Project", "Hub"], status: "planned", probeAreas: ["Assets"] },
  {
    id: "reviews",
    title: "Reviews Dashboard",
    description: "Document reviews across any set of projects: open and overdue steps, who reviews are waiting on, throughput by workflow and time to finish.",
    scope: ["Project", "Hub"],
    status: "live",
    probeAreas: ["Reviews"],
    href: (h) => `/reviews-dashboard?hubId=${encodeURIComponent(h)}`,
  },
  { id: "submittals", title: "Submittals Dashboard", description: "Submittal items by status, ball in court and due date.", scope: ["Project", "Hub"], status: "planned", probeAreas: ["Submittals"] },
  { id: "photos", title: "Photos Dashboard", description: "Photo capture over time, by type and location.", scope: ["Project", "Hub"], status: "planned", probeAreas: ["Photos"] },
  { id: "model-coordination", title: "Model Coordination", description: "Clash groups and model set coverage.", scope: ["Project"], status: "planned", probeAreas: ["Model coordination"] },
];
