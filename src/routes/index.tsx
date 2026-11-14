import { createFileRoute, useNavigate } from "@tanstack/react-router";
import welcomeBg from "@/assets/welcome-space.jpg";
import { PixelWord } from "@/components/pixel/PixelWord";
import { Starfield } from "@/components/pixel/Starfield";
import { AvatarFrame } from "@/components/pixel/CrewBadge";
import { actions, missionDay, useHydrated, useHyperLife } from "@/lib/hyperlife/store";
import { ENVIRONMENTS } from "@/lib/hyperlife/constants";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "HyperLife — Select Astronaut" },
      { name: "description", content: "Choose your crew profile or register a new astronaut on HyperLife." },
      { property: "og:title", content: "HyperLife — Select Astronaut" },
      { property: "og:description", content: "Choose your crew profile or register a new astronaut on HyperLife." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Welcome,
});

function Welcome() {
  const { users } = useHyperLife();
  const hydrated = useHydrated();
  const navigate = useNavigate();

  return (
    <main className="relative min-h-screen overflow-hidden bg-space">
      <img
        src={welcomeBg}
        alt=""
        width={1920}
        height={1088}
        className="pixelated absolute inset-0 h-full w-full object-cover"
      />
      <Starfield count={40} seed={3} />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col items-center px-6 pt-24 pb-14">
        <p className="pixel-label mb-8 text-sky">★ HyperLife crew health system ★</p>
        <PixelWord word="HELLO" pixel={8} className="sm:hidden" />
        <PixelWord word="HELLO" pixel={18} className="hidden sm:flex" />
        <p className="mt-10 text-3xl text-foreground">
          Select astronaut<span className="animate-blink text-gold">_</span>
        </p>

        <div className="mt-10 flex flex-wrap justify-center gap-6">
          {hydrated &&
            users.map((u) => (
              <div key={u.id} className="group relative">
                <button
                  type="button"
                  onClick={() => {
                    actions.selectUser(u.id);
                    navigate({ to: "/base" });
                  }}
                  className="pixel-panel pixel-focus flex w-52 cursor-pointer flex-col items-center gap-3 p-5 transition-transform hover:-translate-y-1 hover:border-gold"
                >
                  <AvatarFrame user={u} size={104} />
                  <span className="pixel-label text-foreground">{u.crewId}</span>
                  <span className="text-xl leading-none text-muted-foreground">
                    {ENVIRONMENTS[u.environment].name} · Day <span className="text-gold">{missionDay(u)}</span>
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${u.crewId}`}
                  onClick={() => {
                    if (window.confirm(`Remove ${u.crewId} and all their logs?`)) actions.removeUser(u.id);
                  }}
                  className="pixel-label absolute -top-2 -right-2 hidden h-7 w-7 cursor-pointer items-center justify-center border-[3px] border-space bg-warn text-foreground group-hover:flex"
                >
                  ×
                </button>
              </div>
            ))}

          <button
            type="button"
            onClick={() => {
              actions.setDraft(null);
              navigate({ to: "/register" });
            }}
            className="pixel-focus flex w-52 cursor-pointer flex-col items-center justify-center gap-4 border-[3px] border-dashed border-pink bg-space/70 p-5 text-pink transition-transform hover:-translate-y-1 hover:bg-panel"
          >
            <span className="flex h-[104px] w-[104px] items-center justify-center border-[3px] border-pink text-6xl leading-none">
              +
            </span>
            <span className="pixel-label">Add user</span>
            <span className="text-xl leading-none text-muted-foreground">New crew member</span>
          </button>
        </div>

        <p className="pixel-label mt-auto pt-16 text-muted-foreground">v1.0 · Mission control 2026</p>
      </div>
    </main>
  );
}
