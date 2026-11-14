import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { seededRandom } from "@/lib/hyperlife/scoring";

const TONES = ["bg-foreground", "bg-pink", "bg-gold", "bg-sky", "bg-lavender"];

/** Deterministic twinkling pixel stars (same on server + client). */
export function Starfield({ count = 70, seed = 7, className }: { count?: number; seed?: number; className?: string }) {
  const stars = useMemo(() => {
    const r = seededRandom(seed);
    return Array.from({ length: count }, () => ({
      x: r() * 100,
      y: r() * 100,
      s: r() < 0.8 ? 2 : 4,
      tone: TONES[Math.floor(r() * TONES.length)],
      delay: r() * 3,
    }));
  }, [count, seed]);
  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden>
      {stars.map((s, i) => (
        <span
          key={i}
          className={cn("absolute animate-twinkle", s.tone)}
          style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, animationDelay: `${s.delay}s` }}
        />
      ))}
    </div>
  );
}
