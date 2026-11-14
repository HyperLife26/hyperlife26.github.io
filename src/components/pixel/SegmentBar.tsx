import { cn } from "@/lib/utils";

type Tone = "lavender" | "mint" | "gold" | "peach" | "sky" | "pink" | "warn";
const FILL: Record<Tone, string> = {
  lavender: "bg-lavender",
  mint: "bg-mint",
  gold: "bg-gold",
  peach: "bg-peach",
  sky: "bg-sky",
  pink: "bg-pink",
  warn: "bg-warn",
};

/** Read-only segmented gauge like the Food Diary fuel gauges. */
export function SegmentBar({
  value,
  max,
  segments = 16,
  tone = "lavender",
  className,
  height = "h-3",
}: {
  value: number;
  max: number;
  segments?: number;
  tone?: Tone;
  className?: string;
  height?: string;
}) {
  const filled = max > 0 ? Math.round(Math.min(1, value / max) * segments) : 0;
  return (
    <div className={cn("flex gap-[3px]", className)} aria-hidden>
      {Array.from({ length: segments }, (_, i) => (
        <span key={i} className={cn("flex-1", height, i < filled ? FILL[tone] : "bg-space")} />
      ))}
    </div>
  );
}

/** Clickable segmented slider (workload, pain). */
export function SegmentInput({
  value,
  onChange,
  min = 0,
  max = 10,
  tones,
  label,
  lowLabel,
  highLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  tones: (i: number) => Tone;
  label: string;
  lowLabel: string;
  highLabel: string;
}) {
  const count = max - min + 1;
  return (
    <div>
      <div
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        className="pixel-inset pixel-focus flex gap-1 p-2"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowUp") onChange(Math.min(max, value + 1));
          if (e.key === "ArrowLeft" || e.key === "ArrowDown") onChange(Math.max(min, value - 1));
        }}
      >
        {Array.from({ length: count }, (_, i) => {
          const v = min + i;
          const on = v <= value;
          return (
            <button
              key={v}
              type="button"
              tabIndex={-1}
              onClick={() => onChange(v)}
              className={cn(
                "h-9 flex-1 cursor-pointer transition-colors",
                on ? FILL[tones(i)] : "bg-panel-raised hover:bg-muted",
              )}
              aria-label={`${label} ${v}`}
            />
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-lg text-muted-foreground">
        <span>{lowLabel}</span>
        <span className="text-gold">
          {value}/{max}
        </span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
}
