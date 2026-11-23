// The Siteboard mark, drawn inline so it can animate: Holdpoint's diamond
// outline (same geometry) with a 2x2 board of tiles, the top one citron.
// `loading` draws the outline round and pulses the citron tile.
// `tone="white"` is the whiteout version for teal backgrounds.
export function SiteboardMark({
  size = 22,
  loading = false,
  tone = "colour",
  className,
}: {
  size?: number;
  loading?: boolean;
  tone?: "colour" | "white";
  className?: string;
}) {
  const ink = tone === "white" ? "#ffffff" : "#006881";
  const accent = tone === "white" ? "#ffffff" : "#d1c800";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <rect
        x="4"
        y="4"
        width="16"
        height="16"
        transform="rotate(45 12 12)"
        fill="none"
        stroke={ink}
        strokeWidth="3"
        {...(loading ? { strokeDasharray: "64", style: { animation: "sb-draw 1.8s cubic-bezier(0.45, 0, 0.25, 1) infinite" } } : {})}
      />
      <g transform="rotate(45 12 12)">
        <rect x="8.2" y="8.2" width="3.4" height="3.4" fill={accent} style={loading ? { animation: "sb-tile 0.9s ease-in-out infinite" } : undefined} />
        <rect x="12.4" y="8.2" width="3.4" height="3.4" fill={ink} />
        <rect x="8.2" y="12.4" width="3.4" height="3.4" fill={ink} />
        <rect x="12.4" y="12.4" width="3.4" height="3.4" fill={ink} />
      </g>
    </svg>
  );
}
