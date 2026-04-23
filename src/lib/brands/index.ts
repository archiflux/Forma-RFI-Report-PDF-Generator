export interface Brand {
  id: string;
  name: string;
  primary: string;
  accent: string;
  ink: string;
  muted: string;
  surface: string;
  // Optional logo as a data URL or same-origin path. Data URLs work for both
  // web display and @react-pdf/renderer without extra CORS configuration.
  logo?: string;
}

export const DEFAULT_BRAND: Brand = {
  id: "default",
  name: "Bailey Partnership",
  primary: "#0f3d5c",
  accent: "#d97706",
  ink: "#111827",
  muted: "#6b7280",
  surface: "#ffffff",
};

export const BRANDS: Record<string, Brand> = {
  default: DEFAULT_BRAND,
};

export function resolveBrand(id: string | undefined): Brand {
  if (!id) return DEFAULT_BRAND;
  return BRANDS[id] ?? DEFAULT_BRAND;
}
