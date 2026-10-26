// Categorical colours in fixed order; "Other" is always neutral grey.
export const SERIES = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
] as const;

export function colourFor(index: number, label: string): string {
  if (label === "Other") return "var(--series-other)";
  return SERIES[index % SERIES.length] as string;
}
