import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { RequireCrew } from "@/components/pixel/RequireCrew";
import { ScreenShell } from "@/components/pixel/ScreenShell";
import { Panel } from "@/components/pixel/Panel";
import { PixelIcon } from "@/components/pixel/PixelIcon";
import { PixelChart } from "@/components/pixel/PixelChart";
import { SegmentBar } from "@/components/pixel/SegmentBar";
import { AvatarFrame } from "@/components/pixel/CrewBadge";
import { ENVIRONMENTS } from "@/lib/hyperlife/constants";
import { crewStandings, energyFor, missionDay, useHyperLife } from "@/lib/hyperlife/store";
import {
  RISK_LABELS,
  buildSuggestions,
  completedLogs,
  evaluateDay,
  isDayComplete,
  riskLevel,
  riskTrend,
  statusForZ,
  type Risks,
  type VitalSeries,
  type VitalStatus,
} from "@/lib/hyperlife/scoring";
import type { CrewMember, DayLog } from "@/lib/hyperlife/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Health Dashboard — HyperLife" },
      { name: "description", content: "Live vitals, hazard risks, suggestions and crew score comparison." },
      { property: "og:title", content: "Health Dashboard — HyperLife" },
      { property: "og:description", content: "Live vitals, hazard risks, suggestions and crew score comparison." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <RequireCrew>{(ctx) => <Dashboard {...ctx} />}</RequireCrew>,
});

const RISK_COLOR: Record<keyof Risks, string> = {
  cardiovascular: "var(--pink)",
  bone: "var(--peach)",
  nutrition: "var(--gold)",
  immune: "var(--mint)",
  mental: "var(--sky)",
};
const STATUS_BG: Record<VitalStatus, string> = { ok: "bg-mint", watch: "bg-gold", alert: "bg-warn" };
const STATUS_TEXT: Record<VitalStatus, string> = { ok: "text-mint", watch: "text-gold", alert: "text-warn" };
const LEVEL_TEXT = { low: "text-mint", moderate: "text-gold", high: "text-warn" } as const;
const LEVEL_BAR = { low: "mint", moderate: "gold", high: "warn" } as const;

function Dashboard({ user, todayLog, today, logs }: { user: CrewMember; todayLog?: DayLog; today: string; logs: Record<string, DayLog> }) {
  const energy = energyFor(user, logs);
  if (!isDayComplete(todayLog)) return <Locked user={user} todayLog={todayLog} energy={energy} />;
  return <Unlocked user={user} day={todayLog} today={today} energy={energy} />;
}

function Locked({ user, todayLog, energy }: { user: CrewMember; todayLog?: DayLog; energy: number }) {
  const c = completedLogs(todayLog);
  const items = [
    { to: "/mood" as const, label: "Mood form", done: c.mood },
    { to: "/food" as const, label: "Food diary", done: c.food },
    { to: "/health" as const, label: "General health form", done: c.health },
  ];
  return (
    <ScreenShell icon="lock" title="Health dashboard" user={user} energy={energy}>
      <Panel className="mx-auto mt-10 max-w-xl text-center">
        <PixelIcon name="lock" size={72} className="mx-auto" />
        <h2 className="pixel-title mt-6 text-pink">Access denied</h2>
        <p className="mt-3 text-2xl text-muted-foreground">Finish logging your daily information to access the health overview dashboard.</p>
        <ul className="mt-6 space-y-3 text-left">
          {items.map((i) => (
            <li key={i.to}>
              <Link to={i.to} className="pixel-focus flex items-center justify-between border-[3px] border-input bg-space px-4 py-3 text-2xl hover:border-gold">
                <span>{i.label}</span>
                {i.done ? <PixelIcon name="check" size={22} /> : <span className="pixel-label text-pink">Log now ▶</span>}
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
    </ScreenShell>
  );
}

function Unlocked({ user, day, today, energy }: { user: CrewMember; day: Required<DayLog>; today: string; energy: number }) {
  const state = useHyperLife();
  const ev = useMemo(() => evaluateDay(user, day, today), [user, day, today]);
  const trend = useMemo(() => riskTrend(user, ev.risks, today), [user, ev.risks, today]);
  const tips = useMemo(() => buildSuggestions(user, day, ev.risks), [user, day, ev.risks]);
  const standings = crewStandings(state);
  const vitals = [ev.vitals.hr, ev.vitals.spo2, ev.vitals.temp];
  const worst = vitals.reduce<VitalStatus>((acc, v) => {
    const s = statusForZ(v.z);
    return s === "alert" || (s === "watch" && acc === "ok") ? s : acc;
  }, "ok");
  const riskKeys = Object.keys(RISK_LABELS) as (keyof Risks)[];
  const cautions = riskKeys.filter((k) => riskLevel(ev.risks[k]) !== "low");

  return (
    <ScreenShell icon="dashboard" title="Health dashboard" user={user} energy={energy}>
      <div className="space-y-6">
        {/* ---------- vitals ---------- */}
        <Panel
          kicker="Live vitals vs your baseline"
          action={<span className={cn("pixel-label border-[3px] px-3 py-1", STATUS_TEXT[worst], "border-current")}>Wearable: {worst}</span>}
        >
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
            {vitals.map((v) => (
              <VitalCard key={v.key} v={v} />
            ))}
          </div>
          <div className="mt-6 flex h-4 gap-[2px]">
            {ev.vitals.timeline.map((s, i) => (
              <span key={i} className={cn("flex-1", STATUS_BG[s])} />
            ))}
          </div>
          <div className="mt-2 flex flex-col gap-2 text-xl text-muted-foreground md:flex-row md:items-center md:justify-between">
            <span>Wearable status over time: <span className="text-mint">green normal</span> · <span className="text-gold">amber watch</span> · <span className="text-warn">red alert</span></span>
            <div className="flex gap-2">
              {vitals.map((v) => {
                const s = statusForZ(v.z);
                return (
                  <span key={v.key} className={cn("pixel-label border-2 border-current px-2 py-1", STATUS_TEXT[s])}>
                    {v.label}: {s}
                  </span>
                );
              })}
            </div>
          </div>
        </Panel>

        {/* ---------- hazards ---------- */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.7fr]">
          <Panel kicker="Hazard risk now">
            <ul className="space-y-4">
              {riskKeys.map((k) => {
                const v = ev.risks[k];
                const lvl = riskLevel(v);
                return (
                  <li key={k}>
                    <div className={cn("flex justify-between text-2xl leading-none", LEVEL_TEXT[lvl])}>
                      <span>{RISK_LABELS[k]}</span>
                      <span>
                        {v}% {lvl} {lvl !== "low" && "⚠"}
                      </span>
                    </div>
                    <SegmentBar value={v} max={100} segments={20} tone={LEVEL_BAR[lvl]} className="mt-1" />
                  </li>
                );
              })}
            </ul>
            {cautions.length > 0 && (
              <div className="mt-5 space-y-1 text-lg leading-tight text-muted-foreground">
                {cautions.map((k) => (
                  <p key={k}>
                    ⚠ {RISK_LABELS[k]}: {ev.risks[k]}% — {riskLevel(ev.risks[k]) === "high" ? "notify flight surgeon." : "keep an eye on it."}
                  </p>
                ))}
              </div>
            )}
          </Panel>

          <Panel kicker="Risk trend">
            <PixelChart
              height={230}
              min={0}
              max={100}
              yTicks={[100, 50, 0]}
              refLines={[
                { value: 60, label: "high 60%" },
                { value: 30, label: "moderate 30%" },
              ]}
              series={riskKeys.map((k) => ({ values: trend[k], color: RISK_COLOR[k] }))}
            />
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xl">
              {riskKeys.map((k) => (
                <span key={k} className="flex items-center gap-2">
                  <span className="h-3 w-3" style={{ background: RISK_COLOR[k] }} />
                  {RISK_LABELS[k]} {ev.risks[k]}%
                </span>
              ))}
            </div>
          </Panel>
        </div>

        {/* ---------- suggestions ---------- */}
        <Panel kicker="Mission control suggestions" title="Today's plan">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {tips.map((t) => (
              <div
                key={t.title}
                className={cn(
                  "border-[3px] bg-space p-4",
                  t.tone === "warn" ? "border-pink" : t.tone === "good" ? "border-mint" : "border-sky",
                )}
              >
                <p className={cn("pixel-label", t.tone === "warn" ? "text-pink" : t.tone === "good" ? "text-mint" : "text-sky")}>
                  {t.tone === "warn" ? "! " : t.tone === "good" ? "★ " : "› "}
                  {t.title}
                </p>
                <p className="mt-2 text-xl leading-tight text-foreground">{t.text}</p>
              </div>
            ))}
          </div>
        </Panel>

        {/* ---------- crew score ---------- */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
          <Panel kicker="Your crew score" className="text-center">
            <AvatarFrame user={user} size={96} className="mx-auto" />
            <p className="mt-4 text-8xl leading-none text-gold">
              {ev.score}
              <span className="text-2xl text-muted-foreground">/100</span>
            </p>
            <p className="pixel-label mt-3">
              Rank <span className="text-sky">{ev.rank}</span>
            </p>
            <p className="mt-4 text-lg leading-tight text-muted-foreground">Generated from today's hazard risks: lower risk = higher score.</p>
          </Panel>

          <Panel kicker="Crew leaderboard" title="Compare scores">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-2xl">
              <thead>
                <tr className="pixel-label text-left text-muted-foreground">
                  <th className="pb-3 font-normal">#</th>
                  <th className="pb-3 font-normal">Astronaut</th>
                  <th className="pb-3 font-normal">Base</th>
                  <th className="pb-3 font-normal">Score</th>
                  <th className="pb-3 text-right font-normal">Rank</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((s, i) => {
                  const me = s.user.id === user.id;
                  const delta = s.score !== null && s.previous !== null ? s.score - s.previous : null;
                  return (
                    <tr key={s.user.id} className={cn("border-t-[3px] border-space", me && "bg-panel-raised")}>
                      <td className="py-2 pl-2 text-gold">{i + 1}</td>
                      <td className="py-2">
                        <div className="flex items-center gap-3">
                          <AvatarFrame user={s.user} size={40} />
                          <div>
                            <p className="pixel-label">
                              {s.user.crewId} {me && <span className="text-pink">(you)</span>}
                            </p>
                            <p className="text-lg leading-none text-muted-foreground">
                              Day {missionDay(s.user)} · {s.date === today ? "today" : (s.date ?? "no logs")}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 text-muted-foreground">{ENVIRONMENTS[s.user.environment].short}</td>
                      <td className="w-[38%] py-2">
                        {s.score === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <div className="flex items-center gap-3">
                            <span className="w-10 text-gold">{s.score}</span>
                            <SegmentBar value={s.score} max={100} segments={20} tone={me ? "pink" : "lavender"} className="flex-1" />
                            {delta !== null && (
                              <span className={cn("w-12 text-lg", delta >= 0 ? "text-mint" : "text-warn")}>
                                {delta >= 0 ? "▲" : "▼"}
                                {Math.abs(delta)}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-2 pr-2 text-right text-sky">{s.rank ?? "–"}</td>
                    </tr>
                  );
                })}
              </tbody>
              </table>
            </div>
          </Panel>
        </div>
      </div>
    </ScreenShell>
  );
}

function VitalCard({ v }: { v: VitalSeries }) {
  const s = statusForZ(v.z);
  const color = v.key === "hr" ? "var(--pink)" : v.key === "spo2" ? "var(--sky)" : "var(--peach)";
  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-2xl leading-none">{v.label}</p>
          <p className="mt-1 text-lg leading-none text-muted-foreground">
            baseline {v.baseline} · z-score <span className={STATUS_TEXT[s]}>{v.z >= 0 ? "+" : ""}{v.z}</span>
          </p>
        </div>
        <p className="text-5xl leading-none text-foreground">
          {v.current}
          <span className="ml-1 text-xl text-muted-foreground">{v.unit}</span>
        </p>
      </div>
      <PixelChart
        className="mt-3"
        height={110}
        min={v.min}
        max={v.max}
        band={[v.baseline - v.sd * 1.5, v.baseline + v.sd * 1.5]}
        series={[{ values: v.values, color }]}
      />
    </div>
  );
}
