import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useCurrentUser, useHydrated } from "@/lib/hyperlife/store";
import type { CrewMember, DayLog } from "@/lib/hyperlife/types";

export function BootScreen({ label = "BOOTING HYPERLIFE" }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-space">
      <p className="pixel-label text-sky">
        {label}
        <span className="animate-blink">_</span>
      </p>
    </div>
  );
}

/** Renders children only once a crew member is selected; otherwise back to the welcome screen. */
export function RequireCrew({
  children,
}: {
  children: (ctx: { user: CrewMember; todayLog: DayLog | undefined; today: string; logs: Record<string, DayLog> }) => ReactNode;
}) {
  const hydrated = useHydrated();
  const ctx = useCurrentUser();
  const navigate = useNavigate();
  useEffect(() => {
    if (hydrated && !ctx.user) navigate({ to: "/" });
  }, [hydrated, ctx.user, navigate]);
  if (!hydrated || !ctx.user) return <BootScreen />;
  return <>{children({ ...ctx, user: ctx.user })}</>;
}
