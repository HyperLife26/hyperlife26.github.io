import type { FaceScale } from "@/lib/hyperlife/types";
import { cn } from "@/lib/utils";
import { PixelFace } from "./PixelFace";

export function FaceScalePicker({
  value,
  onChange,
  labels,
  name,
}: {
  value: FaceScale | null;
  onChange: (v: FaceScale) => void;
  labels: readonly string[];
  name: string;
}) {
  return (
    <div role="radiogroup" aria-label={name} className="grid grid-cols-5 gap-3">
      {([1, 2, 3, 4, 5] as FaceScale[]).map((lvl) => {
        const on = value === lvl;
        return (
          <button
            key={lvl}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(lvl)}
            className={cn(
              "pixel-focus flex cursor-pointer flex-col items-center gap-2 border-[3px] bg-space px-2 py-3 transition-transform",
              on ? "-translate-y-1 border-gold bg-panel-raised" : "border-input hover:border-lavender",
            )}
          >
            <PixelFace level={lvl} size={44} className={on ? "animate-bob" : undefined} />
            <span className={cn("text-lg leading-none", on ? "text-gold" : "text-muted-foreground")}>{labels[lvl - 1]}</span>
          </button>
        );
      })}
    </div>
  );
}

export function ChoiceRow<T extends string>({
  options,
  value,
  onChange,
  name,
}: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
  name: string;
}) {
  return (
    <div role="radiogroup" aria-label={name} className="grid gap-3" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "pixel-focus h-12 cursor-pointer border-[3px] text-2xl",
              on ? "border-gold bg-gold text-space" : "border-input bg-space text-foreground hover:border-lavender",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Stepper({
  value,
  onChange,
  step,
  min,
  max,
  unit,
  disabled,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  step: number;
  min: number;
  max: number;
  unit: string;
  disabled?: boolean;
  label: string;
}) {
  const btn =
    "pixel-label pixel-focus h-14 w-14 cursor-pointer border-[3px] border-space bg-panel-raised text-xl text-foreground shadow-[3px_3px_0_0_var(--space)] hover:text-gold active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:opacity-40";
  return (
    <div className={cn("flex items-center gap-4", disabled && "opacity-40")}>
      <button type="button" className={btn} disabled={disabled} onClick={() => onChange(Math.max(min, value - step))} aria-label={`Decrease ${label}`}>
        −
      </button>
      <div className="pixel-inset flex h-14 min-w-36 items-center justify-center gap-2 px-4">
        <input
          type="number"
          aria-label={label}
          value={value}
          disabled={disabled}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (!Number.isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
          }}
          className="w-20 bg-transparent text-center text-4xl leading-none text-gold outline-none"
        />
        <span className="text-xl text-muted-foreground">{unit}</span>
      </div>
      <button type="button" className={btn} disabled={disabled} onClick={() => onChange(Math.min(max, value + step))} aria-label={`Increase ${label}`}>
        +
      </button>
    </div>
  );
}
