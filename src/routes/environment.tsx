import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Starfield } from "@/components/pixel/Starfield";
import { PixelButton } from "@/components/pixel/PixelButton";
import { SegmentBar } from "@/components/pixel/SegmentBar";
import { StepHeader } from "@/components/pixel/StepHeader";
import { BootScreen } from "@/components/pixel/RequireCrew";
import { ENVIRONMENTS } from "@/lib/hyperlife/constants";
import { ENV_IMG } from "@/lib/hyperlife/media";
import { actions, useHydrated, useHyperLife } from "@/lib/hyperlife/store";
import type { EnvironmentKind } from "@/lib/hyperlife/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/environment")({
  head: () => ({
    meta: [
      { title: "Choose Environment — HyperLife" },
      { name: "description", content: "Pick your mission environment: Moon base, Mars base or spaceship." },
      { property: "og:title", content: "Choose Environment — HyperLife" },
      { property: "og:description", content: "Pick your mission environment: Moon base, Mars base or spaceship." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EnvironmentPage,
});

function EnvironmentPage() {
  const hydrated = useHydrated();
  const { draft, currentUserId } = useHyperLife();
  const navigate = useNavigate();
  const [env, setEnv] = useState<EnvironmentKind | null>(null);

  useEffect(() => {
    // `registerFromDraft` clears the draft as soon as the crew member exists.
    // Keep the page mounted for that navigation so it doesn't bounce back to
    // /register before the launch handler can move on to /base.
    if (hydrated && !draft?.crewId && !currentUserId) navigate({ to: "/register" });
  }, [hydrated, draft, currentUserId, navigate]);

  if (!hydrated || (!draft?.crewId && !currentUserId)) return <BootScreen />;

  const launch = () => {
    if (!env) return;
    const user = actions.registerFromDraft(env);
    if (!user) {
      navigate({ to: "/register" });
      return;
    }
    toast(`Welcome aboard, ${user.crewId}!`);
    navigate({ to: "/base" });
  };

  return (
    <main className="relative min-h-screen bg-space">
      <Starfield count={80} seed={33} />
      <div className="relative mx-auto max-w-6xl px-6 py-10">
        <StepHeader step={2} title="Pick your environment" />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {(Object.keys(ENVIRONMENTS) as EnvironmentKind[]).map((k) => {
            const e = ENVIRONMENTS[k];
            const on = env === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setEnv(k)}
                aria-pressed={on}
                className={cn(
                  "pixel-panel pixel-focus cursor-pointer p-3 text-left transition-transform hover:-translate-y-1",
                  on && "border-gold shadow-[inset_0_0_0_3px_var(--space),0_0_0_3px_var(--space),0_0_0_6px_var(--gold)]",
                )}
              >
                <img src={ENV_IMG[k]} alt={e.name} width={1536} height={864} loading="lazy" className="pixelated aspect-[4/3] w-full object-cover" />
                <div className="p-3">
                  <h2 className={cn("pixel-title", on ? "text-gold" : "text-foreground")}>
                    {on ? "▶ " : ""}
                    {e.name}
                  </h2>
                  <p className="mt-2 text-xl leading-tight text-muted-foreground">{e.blurb}</p>

                  <dl className="mt-4 space-y-3">
                    <div>
                      <div className="flex justify-between text-xl leading-none">
                        <dt className="text-sky">Gravity</dt>
                        <dd>
                          {e.gravity === 0 ? "≈0" : e.gravity} m/s² <span className="text-muted-foreground">({e.gravityG === 0 ? "micro-g" : `${e.gravityG}g`})</span>
                        </dd>
                      </div>
                      <SegmentBar value={e.gravity} max={9.81} segments={12} tone="sky" className="mt-1" />
                    </div>
                    <div>
                      <div className="flex justify-between text-xl leading-none">
                        <dt className="text-peach">Radiation</dt>
                        <dd>{e.radiation} mSv/day</dd>
                      </div>
                      <SegmentBar value={e.radiation} max={2} segments={12} tone="peach" className="mt-1" />
                    </div>
                  </dl>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-8 flex justify-between">
          <PixelButton variant="outline" onClick={() => navigate({ to: "/register" })}>
            ◀ Back
          </PixelButton>
          <PixelButton variant="gold" size="lg" disabled={!env} onClick={launch}>
            Launch mission ▶
          </PixelButton>
        </div>
      </div>
    </main>
  );
}
