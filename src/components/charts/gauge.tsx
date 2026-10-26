// Half-circle gauge for a single headline number (e.g. average days to
// close). The scale runs from 0 to a round number above the value.
function niceMax(v: number): number {
  const target = Math.max(10, v * 1.5);
  const pow = 10 ** Math.floor(Math.log10(target));
  return Math.ceil(target / pow) * pow;
}

export function Gauge({ value, unit, caption }: { value: number | null; unit: string; caption: string }) {
  if (value === null) return <p className="text-sm text-[color:var(--brand-muted)]">Not enough closed records yet.</p>;
  const max = niceMax(value);
  const t = Math.min(1, value / max);
  const R = 80;
  const cx = 100;
  const cy = 100;
  const angle = Math.PI * (1 - t);
  const end = { x: cx + R * Math.cos(angle), y: cy - R * Math.sin(angle) };
  const needle = { x: cx + (R - 20) * Math.cos(angle), y: cy - (R - 20) * Math.sin(angle) };
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 120" className="h-auto w-full max-w-[260px]" role="img" aria-label={`${caption}: ${value.toFixed(1)} ${unit}`}>
        <path d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`} fill="none" stroke="var(--chart-grid)" strokeWidth={16} strokeLinecap="round" />
        <path d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${end.x} ${end.y}`} fill="none" stroke="var(--series-1)" strokeWidth={16} strokeLinecap="round" />
        <line x1={cx} y1={cy} x2={needle.x} y2={needle.y} stroke="#0e2841" strokeWidth={3} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={6} fill="#0e2841" />
        <text x={cx - R} y={cy + 16} textAnchor="middle" fontSize={9} fill="#6b7280">0</text>
        <text x={cx + R} y={cy + 16} textAnchor="middle" fontSize={9} fill="#6b7280">{max}</text>
      </svg>
      <p className="-mt-2 text-3xl font-semibold tabular-nums text-[color:var(--brand-primary)]">{value.toFixed(1)}</p>
      <p className="text-xs text-[color:var(--brand-muted)]">{unit}</p>
    </div>
  );
}
