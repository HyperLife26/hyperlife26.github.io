import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function StepHeader({ step, title }: { step: 1 | 2; title: string }) {
  return (
    <header className="mb-8 flex items-end justify-between gap-6">
      <div>
        <Link to="/" className="pixel-label text-muted-foreground hover:text-gold">
          ◀ Crew select
        </Link>
        <h1 className="pixel-title mt-4 text-2xl text-gold">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        {[1, 2].map((n) => (
          <div key={n} className="flex items-center gap-3">
            <span
              className={cn(
                "pixel-label flex h-10 w-10 items-center justify-center border-[3px]",
                n === step ? "border-gold bg-gold text-space" : n < step ? "border-mint bg-mint text-space" : "border-lavender text-muted-foreground",
              )}
            >
              {n}
            </span>
            {n === 1 && <span className="h-[3px] w-10 bg-lavender" />}
          </div>
        ))}
        <span className="pixel-label ml-2 text-muted-foreground">Step {step}/2</span>
      </div>
    </header>
  );
}
