/**
 * Dependency-free SVG sparkline for the hit-rate trend.
 * Renders a smooth polyline scaled to the data range.
 */
export function Sparkline({
  points,
  width = 480,
  height = 120,
  stroke = "currentColor",
}: {
  points: number[];
  width?: number;
  height?: number;
  stroke?: string;
}) {
  if (points.length === 0) {
    return (
      <div className="flex h-[120px] items-center justify-center text-sm text-muted-foreground">
        No data yet
      </div>
    );
  }

  const pad = 6;
  const min = Math.min(...points, 0);
  const max = Math.max(...points, 100);
  const range = max - min || 1;
  const stepX =
    points.length > 1 ? (width - pad * 2) / (points.length - 1) : 0;

  const coords = points.map((v, i) => {
    const x = pad + i * stepX;
    const y = height - pad - ((v - min) / range) * (height - pad * 2);
    return [x, y] as const;
  });

  const path = coords
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");

  // Baseline at 50%.
  const baselineY =
    height - pad - ((50 - min) / range) * (height - pad * 2);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full text-primary"
      role="img"
      aria-label="Hit-rate trend"
    >
      <line
        x1={pad}
        x2={width - pad}
        y1={baselineY}
        y2={baselineY}
        stroke="currentColor"
        strokeOpacity={0.15}
        strokeDasharray="4 4"
      />
      <path d={path} fill="none" stroke={stroke} strokeWidth={2} />
      {coords.length > 0 && (
        <circle
          cx={coords[coords.length - 1][0]}
          cy={coords[coords.length - 1][1]}
          r={3}
          fill={stroke}
        />
      )}
    </svg>
  );
}
