import { cn } from "@/lib/utils";

// 5x7 bitmap font for the letters we need
const GLYPHS: Record<string, string[]> = {
  H: ["X...X", "X...X", "X...X", "XXXXX", "X...X", "X...X", "X...X"],
  E: ["XXXXX", "X....", "X....", "XXXX.", "X....", "X....", "XXXXX"],
  L: ["X....", "X....", "X....", "X....", "X....", "X....", "XXXXX"],
  O: [".XXX.", "X...X", "X...X", "X...X", "X...X", "X...X", ".XXX."],
};

/** Big chunky bitmap word, each letter bobbing on its own beat. */
export function PixelWord({ word, pixel = 14, className }: { word: string; pixel?: number; className?: string }) {
  return (
    <div className={cn("flex items-end", className)} style={{ gap: pixel * 1.5 }} aria-label={word} role="heading" aria-level={1}>
      {[...word].map((ch, i) => {
        const g = GLYPHS[ch];
        if (!g) return null;
        return (
          <div
            key={i}
            className="relative animate-bob"
            style={{ animationDelay: `${i * 0.18}s` }}
            aria-hidden
          >
            {/* drop shadow layer */}
            <Glyph grid={g} pixel={pixel} className="absolute bg-lavender" offset={pixel * 0.6} />
            <Glyph grid={g} pixel={pixel} className="relative text-hello" />
          </div>
        );
      })}
    </div>
  );
}

function Glyph({ grid, pixel, className, offset = 0 }: { grid: string[]; pixel: number; className?: string; offset?: number }) {
  const w = grid[0].length * pixel;
  const h = grid.length * pixel;
  return (
    <div
      className={className}
      style={{
        width: w,
        height: h,
        top: offset,
        left: offset,
        backgroundSize: `${w}px ${h}px`,
        clipPath: `path('${grid
          .flatMap((row, y) =>
            [...row].map((c, x) =>
              c === "X" ? `M${x * pixel} ${y * pixel}h${pixel}v${pixel}h-${pixel}z` : "",
            ),
          )
          .join("")}')`,
      }}
    />
  );
}
