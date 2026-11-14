import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Starfield } from "./Starfield";
import { PixelIcon, type IconName } from "./PixelIcon";
import { CrewBadge } from "./CrewBadge";
import type { CrewMember } from "@/lib/hyperlife/types";

/** Shared frame for the inner log screens (mood, health, food, dashboard). */
export function ScreenShell({
  icon,
  title,
  user,
  energy,
  right,
  children,
}: {
  icon: IconName;
  title: string;
  user: CrewMember;
  energy: number;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="relative min-h-screen bg-space">
      <Starfield count={90} seed={11} />
      <div className="relative mx-auto max-w-[1440px] px-6 py-6">
        <header className="pixel-panel mb-6 flex items-center justify-between gap-6 px-5 py-3">
          <div className="flex items-center gap-4">
            <Link
              to="/base"
              className="pixel-label pixel-focus border-[3px] border-space bg-panel-raised px-3 py-2 text-foreground shadow-[3px_3px_0_0_var(--space)] hover:text-gold"
            >
              ◀ Base
            </Link>
            <PixelIcon name={icon} size={28} />
            <h1 className="pixel-title text-gold">{title}</h1>
          </div>
          <div className="flex items-center gap-4">
            {right}
            <CrewBadge user={user} energy={energy} compact />
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
