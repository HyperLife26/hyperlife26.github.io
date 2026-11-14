import { cn } from "@/lib/utils";

export interface ChartSeries {
  values: number[];
  color: string; // css var e.g. "var(--pink)"
  label?: string;
}

/** Stepped (pixel) line chart drawn in SVG. */
export function PixelChart({
  series,
  min,
  max,
  band,
  refLines = [],
  height = 120,
  className,
  yTicks,
  xLabels = ["-7 min", "now"],
  markers = [],
}: {
  series: ChartSeries[];
  min: number;
  max: number;
  band?: [number, number];
  refLines?: { value: number; label: string }[];
  height?: number;
  className?: string;
  yTicks?: number[];
  xLabels?: [string, string];
  markers?: { position: number; label: string }[];
}) {
  const W = 400;
  const H = 100;
  const n = Math.max(...series.map((s) => s.values.length));
  const x = (i: number) => (i / Math.max(1, n - 1)) * W;
  const y = (v: number) => H - ((v - min) / (max - min || 1)) * H;
  const stepPath = (vals: number[]) =>
    vals
      .map((v, i) => {
        const px = x(i);
        const py = y(v);
        if (i === 0) return `M${px},${py}`;
        return `H${px} V${py}`;
      })
      .join(" ");
  const ticks = yTicks ?? [max, (max + min) / 2, min];

  return (
    <div className={cn("flex gap-2", className)}>
      <div className="flex flex-col justify-between text-base leading-none text-muted-foreground" style={{ height }}>
        {ticks.map((t) => (
          <span key={t}>{Number.isInteger(t) ? t : t.toFixed(1)}</span>
        ))}
      </div>
      <div className="flex-1">
        <div className="pixel-inset relative" style={{ height }}>
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" shapeRendering="crispEdges">
            {band && (
              <rect
                x={0}
                y={y(band[1])}
                width={W}
                height={Math.max(0, y(band[0]) - y(band[1]))}
                fill="var(--mint)"
                opacity={0.12}
              />
            )}
            {[0.25, 0.5, 0.75].map((g) => (
              <line key={g} x1={0} x2={W} y1={H * g} y2={H * g} stroke="var(--lavender)" strokeOpacity={0.15} vectorEffect="non-scaling-stroke" />
            ))}
            {refLines.map((r) => (
              <line
                key={r.label}
                x1={0}
                x2={W}
                y1={y(r.value)}
                y2={y(r.value)}
                stroke="var(--warn)"
                strokeOpacity={0.7}
                strokeDasharray="6 6"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {markers.map((m) => (
              <line
                key={`${m.label}-${m.position}`}
                x1={m.position * W}
                x2={m.position * W}
                y1={0}
                y2={H}
                stroke="var(--gold)"
                strokeOpacity={0.55}
                strokeDasharray="4 4"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {series.map((s, i) => (
              <path
                key={i}
                d={stepPath(s.values)}
                fill="none"
                stroke={s.color}
                strokeWidth={3}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
          {refLines.map((r) => (
            <span
              key={r.label}
              className="absolute left-2 -translate-y-full text-sm leading-none text-warn"
              style={{ top: `${(y(r.value) / H) * 100}%` }}
            >
              {r.label}
            </span>
          ))}
          {markers.map((m) => (
            <span
              key={`${m.label}-${m.position}`}
              className="pixel-label absolute top-1 -translate-x-1/2 bg-space px-1 text-gold"
              style={{ left: `${Math.min(92, Math.max(8, m.position * 100))}%` }}
            >
              {m.label}
            </span>
          ))}
          {series.map((s, i) => (
            <span
              key={i}
              className="absolute right-0 h-2 w-2 translate-x-1/2 -translate-y-1/2"
              style={{ top: `${(y(s.values[s.values.length - 1] ?? min) / H) * 100}%`, background: s.color }}
            />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-base leading-none text-muted-foreground">
          <span>{xLabels[0]}</span>
          <span>{xLabels[1]}</span>
        </div>
      </div>
    </div>
  );
}
