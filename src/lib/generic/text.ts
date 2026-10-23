// Coerces an APS field to display text. Fields documented as strings
// sometimes arrive as arrays (category) or objects ({ id, name }), and
// passing those to string methods crashed the dashboards.
export function asText(v: unknown): string | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) {
    const parts = v.map(asText).filter((x): x is string => Boolean(x));
    return parts.length ? parts.join(", ") : undefined;
  }
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return asText(o.name ?? o.title ?? o.label ?? o.value ?? o.displayName);
  }
  return undefined;
}
