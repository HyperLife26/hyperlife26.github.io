import type { CrewMember } from "@/lib/hyperlife/types";
import { AVATAR_IMG } from "@/lib/hyperlife/media";
import { missionDay } from "@/lib/hyperlife/store";
import { cn } from "@/lib/utils";
import { SegmentBar } from "./SegmentBar";

export function AvatarFrame({ user, size = 72, className }: { user: CrewMember; size?: number; className?: string }) {
  return (
    <div
      className={cn("shrink-0 border-[3px] border-lavender bg-panel shadow-[3px_3px_0_0_var(--space)]", className)}
      style={{ width: size, height: size }}
    >
      <img
        src={AVATAR_IMG[user.avatar]}
        alt={`${user.crewId} avatar`}
        width={size}
        height={size}
        className="pixelated h-full w-full object-cover"
      />
    </div>
  );
}

/** Top-right HUD: avatar, crew id, energy bar, mission day. */
export function CrewBadge({ user, energy, compact = false }: { user: CrewMember; energy: number; compact?: boolean }) {
  return (
    <div className={cn("pixel-hud flex items-center gap-4", compact ? "p-2 pr-4" : "p-3 pr-5")}>
      <AvatarFrame user={user} size={compact ? 52 : 76} />
      <div className={compact ? "w-40" : "w-52"}>
        <p className="pixel-label text-foreground">{user.crewId}</p>
        <div className="mt-2 flex items-center gap-2">
          <span className="pixel-label text-pink">NRG</span>
          <SegmentBar value={energy} max={100} segments={10} tone="pink" height={compact ? "h-2" : "h-3"} className="flex-1" />
        </div>
        <p className="mt-1 text-lg leading-none text-muted-foreground">
          Mission day <span className="text-gold">{missionDay(user)}</span>
          <span className="ml-2 text-sky">{energy}%</span>
        </p>
      </div>
    </div>
  );
}
