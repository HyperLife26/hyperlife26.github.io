import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { RequireCrew } from "@/components/pixel/RequireCrew";
import { CrewBadge } from "@/components/pixel/CrewBadge";
import { PixelIcon, type IconName } from "@/components/pixel/PixelIcon";
import { SegmentBar } from "@/components/pixel/SegmentBar";
import { Starfield } from "@/components/pixel/Starfield";
import { ENVIRONMENTS } from "@/lib/hyperlife/constants";
import { ENV_IMG } from "@/lib/hyperlife/media";
import { actions, crewStandings, energyFor, missionDay, useHyperLife } from "@/lib/hyperlife/store";
import { completedLogs } from "@/lib/hyperlife/scoring";
import type { CrewMember, DayLog } from "@/lib/hyperlife/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/base")({
  head: () => ({
    meta: [
      { title: "Mission Base — HyperLife" },
      { name: "description", content: "Your astronaut base: log mood, food and health to unlock the health dashboard." },
      { property: "og:title", content: "Mission Base — HyperLife" },
      { property: "og:description", content: "Your astronaut base: log mood, food and health to unlock the health dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <RequireCrew>{(ctx) => <Base user={ctx.user} todayLog={ctx.todayLog} logs={ctx.logs} />}</RequireCrew>,
});

type Dest = "/mood" | "/food" | "/health" | "/dashboard";

function Base({ user, todayLog, logs }: { user: CrewMember; todayLog: DayLog | undefined; logs: Record<string, DayLog> }) {
  const navigate = useNavigate();
  const state = useHyperLife();
  const env = ENVIRONMENTS[user.environment];
  const done = completedLogs(todayLog);
  const doneCount = [done.mood, done.food, done.health].filter(Boolean).length;
  const dailyComplete = doneCount === 3;
  const unlocked = true;
  const energy = energyFor(user, logs);
  const standing = crewStandings(state);
  const myPos = standing.findIndex((s) => s.user.id === user.id) + 1;

  const tiles: { to: Dest; icon: IconName; label: string; done: boolean; locked?: boolean }[] = [
    { to: "/mood", icon: "mood", label: "Mood form", done: done.mood },
    { to: "/food", icon: "food", label: "Food diary", done: done.food },
    { to: "/health", icon: "health", label: "Health form", done: done.health },
    { to: "/dashboard", icon: "dashboard", label: "Dashboard", done: false, locked: false },
  ];

  return (
    <main className="flex min-h-screen flex-col bg-space">
      {/* ---------- scene ---------- */}
      <section className="relative h-[62vh] min-h-[440px] overflow-hidden">
        <img src={ENV_IMG[user.environment]} alt={env.name} width={1536} height={864} className="pixelated absolute inset-0 h-full w-full object-cover" />
        <div className="scene-fade absolute inset-0" />
        <Starfield count={30} seed={5} className="opacity-70" />

        {/* top bar */}
        <div className="absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-3 p-4 md:gap-6 md:p-6">
          <div className="pixel-hud flex items-center gap-3 border-lavender px-4 py-3">
            <PixelIcon name="heart" size={24} />
            <span className="pixel-title text-foreground">HYPERLIFE</span>
          </div>
          <div className="pixel-hud hidden items-center border-lavender px-5 py-3 sm:flex">
            <span className="pixel-label text-muted-foreground">Today's logs</span>
            <span className="pixel-title ml-4 text-gold">{doneCount}/3</span>
          </div>
          <CrewBadge user={user} energy={energy} />
        </div>

        {/* left HUD stack, like the inspo resources column */}
        <div className="absolute top-32 left-0 hidden w-64 flex-col gap-3 lg:flex">
          <div className="pixel-hud border-l-0 px-5 py-4">
            <p className="pixel-label text-pink">{env.name}</p>
            <dl className="mt-3 space-y-1 text-2xl leading-none">
              <div className="flex justify-between">
                <dt className="text-sky">Gravity</dt>
                <dd>{env.gravity === 0 ? "micro-g" : `${env.gravity} m/s²`}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-peach">Radiation</dt>
                <dd>{env.radiation} mSv/d</dd>
              </div>
            </dl>
          </div>
          <div className="pixel-hud border-l-0 px-5 py-4">
            <p className="pixel-label text-foreground">Daily checklist</p>
            <ul className="mt-3 space-y-1 text-2xl leading-none">
              {[
                ["Mood", done.mood],
                ["Food", done.food],
                ["Health", done.health],
              ].map(([l, d]) => (
                <li key={l as string} className="flex items-center justify-between">
                  <span className={d ? "text-mint" : "text-muted-foreground"}>{l}</span>
                  {d ? <PixelIcon name="check" size={18} /> : <span className="h-3 w-3 bg-pink" />}
                </li>
              ))}
            </ul>
          </div>
          <div className="pixel-hud border-l-0 px-5 py-4">
            <p className="pixel-label text-foreground">Crew rank</p>
            <p className="mt-2 text-3xl leading-none">
              <span className="text-gold">#{myPos || "–"}</span>
              <span className="text-muted-foreground"> of {standing.length}</span>
            </p>
            <SegmentBar value={energy} max={100} segments={12} tone="pink" className="mt-2" />
          </div>
        </div>
      </section>

      {/* ---------- control deck ---------- */}
      <section className="relative flex-1 border-t-[3px] border-pink">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-[6px] border-panel bg-space px-4 py-4 md:px-10">
          <p className="pixel-label text-foreground">
            Mission day {missionDay(user)} · {env.name}
          </p>
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="pixel-label text-muted-foreground hover:text-gold">
              Live dashboard
            </Link>
            <button
              type="button"
              onClick={() => {
                actions.selectUser(null);
                navigate({ to: "/" });
              }}
              className="pixel-label cursor-pointer bg-panel-raised px-4 py-2 text-muted-foreground hover:text-gold"
            >
              Switch astronaut
            </button>
          </div>
        </div>

        <div className="mx-auto max-w-5xl px-4 py-8 md:px-10">
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:gap-8">
            <div>
              <p className="pixel-title text-foreground">{dailyComplete ? "Daily log complete" : "Live mission running"}</p>
              <p className="mt-3 max-w-xl text-2xl leading-tight text-muted-foreground">
                {dailyComplete ? (
                  <>All logs complete. Open the <span className="text-pink">dashboard</span> for live vitals, model risks and the crew score.</>
                ) : (
                  <>The <span className="text-pink">live dashboard</span> is already running from the mission schedule. Finish today's log to feed your sleep, training and symptoms into the model.</>
                )}
              </p>
            </div>
            <div className="w-full pt-1 md:w-56">
              <p className="pixel-label text-right text-muted-foreground">Progress {doneCount}/3</p>
              <SegmentBar value={doneCount} max={3} segments={12} tone={dailyComplete ? "mint" : "pink"} height="h-4" className="mt-2" />
            </div>
          </div>

          <nav className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-4" aria-label="Daily logs">
            {tiles.map((t) => (
              <Link
                key={t.to}
                to={t.to}
                disabled={!!t.locked}
                aria-disabled={!!t.locked}
                className={cn(
                  "pixel-tile pixel-focus group relative flex flex-col items-center gap-4 px-4 py-6 transition-transform",
                  t.locked ? "cursor-not-allowed opacity-60" : "hover:-translate-y-1 hover:border-foreground",
                  t.to === "/dashboard" && unlocked && "border-foreground",
                )}
              >
                {!t.done && !t.locked && t.to !== "/dashboard" && <span className="absolute -top-2 -right-2 h-4 w-4 bg-pink" aria-label="To do" />}
                {t.done && (
                  <span className="absolute top-2 right-2">
                    <PixelIcon name="check" size={22} title="Done" />
                  </span>
                )}
                <PixelIcon name={t.icon} size={64} />
                <span className="pixel-label text-foreground">{t.label}</span>
                <span className="text-lg leading-none text-muted-foreground">
                  {t.locked ? "Locked" : t.done ? "Logged ✓ edit" : t.to === "/dashboard" ? "Live ▶" : "Log now"}
                </span>
              </Link>
            ))}
          </nav>
        </div>
      </section>
    </main>
  );
}
