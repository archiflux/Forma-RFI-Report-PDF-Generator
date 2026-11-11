// Dashboard template catalogue, modelled on the Forma Insight "Power BI
// Templates" page. `href` builds the route for a hub; templates without one
// are planned and list the probe areas that decide whether they're viable.

export type TemplateStatus = "live" | "planned";

export interface DashboardTemplate {
  id: string;
  title: string;
  description: string;
  scope: Array<"Project" | "Hub">;
  status: TemplateStatus;
  probeAreas: string[];
  // Kept in code but not shown in the catalogue or nav.
  hidden?: boolean;
  href?: string;
}

export const TEMPLATES: DashboardTemplate[] = [
  {
    id: "issues",
    title: "Issues Dashboard",
    description: "BCF issue workflow across any set of projects: status, overdue, ageing, type, root cause and assignee workload. Shareable as a redacted snapshot.",
    scope: ["Project", "Hub"],
    status: "live",
    probeAreas: ["Issues (BCF)"],
    href: "/dashboard",
  },
  {
    id: "rfi-dashboard",
    title: "RFI Dashboard",
    description: "RFIs across any set of projects: open and overdue responses, ball in court, discipline and priority, and time to respond and close.",
    scope: ["Project", "Hub"],
    status: "live",
    probeAreas: ["RFIs"],
    href: "/rfis-dashboard",
  },
  {
    id: "forms",
    title: "Forms Dashboard",
    description: "Forms across any set of projects: open and overdue forms, monthly volume, and breakdowns by template, status, project and creator.",
    scope: ["Project", "Hub"],
    status: "live",
    probeAreas: ["Forms"],
    href: "/forms-dashboard",
  },
  {
    id: "reviews",
    title: "Reviews Dashboard",
    description: "Document reviews across any set of projects: open and overdue steps, who reviews are waiting on, throughput by workflow and time to finish.",
    scope: ["Project", "Hub"],
    status: "live",
    probeAreas: ["Reviews"],
    href: "/reviews-dashboard",
  },
  {
    id: "submittals",
    title: "Submittals Dashboard",
    description: "Submittal items across any set of projects: open and overdue items, ball in court, workflow stage, type and response. Not yet tested against live data.",
    // Hidden October 2026: none of our projects use Submittals yet.
    hidden: true,
    scope: ["Project", "Hub"],
    status: "live",
    probeAreas: ["Submittals"],
    href: "/submittals-dashboard",
  },
];
