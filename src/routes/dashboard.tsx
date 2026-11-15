import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { RequireCrew } from "@/components/pixel/RequireCrew";
import { ScreenShell } from "@/components/pixel/ScreenShell";
import { Panel } from "@/components/pixel/Panel";
import { PixelIcon } from "@/components/pixel/PixelIcon";
import { PixelChart } from "@/components/pixel/PixelChart";
import { SegmentBar } from "@/components/pixel/SegmentBar";
import { AvatarFrame } from "@/components/pixel/CrewBadge";
import { ENVIRONMENTS } from "@/lib/hyperlife/constants";
import { crewStandings, useHyperLife } from "@/lib/hyperlife/store";
import {
  RISK_LABELS,
  completedLogs,
  isDayComplete,
  riskLevel,
  statusForZ,
  type Risks,
  type VitalSeries,
  type VitalStatus,
} from "@/lib/hyperlife/scoring";
import type { CrewMember, DayLog } from "@/lib/hyperlife/types";
import { missionAdvice } from "@/lib/mission/advice";
import { briefSourceLabel } from "@/lib/mission/brief";
import { formatClock, formatDuration } from "@/lib/mission/deterministic";
import { useMissionBrief, useMissionClock, useMissionView } from "@/lib/mission/hooks";
import { loadWebModel } from "@/lib/mission/modelRuntime";
import { SCENARIO_ACCENT, SCENARIO_LABEL, SCENARIO_SHORT } from "@/lib/mission/scenario";
import type { MissionSnapshot, MissionView } from "@/lib/mission/snapshot";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Health Dashboard · HyperLife" },
      { name: "description", content: "Live vitals, hazard risks, suggestions and crew score comparison." },
      { property: "og:title", content: "Health Dashboard · HyperLife" },
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

const HW_KEYS = ["cardio", "bone", "immune", "radiation", "sleep"] as const;
const HW_LABEL: Record<(typeof HW_KEYS)[number], string> = {
  cardio: "Cardiovascular",
  bone: "Bone",
  immune: "Immune",
  radiation: "Radiation",
  sleep: "Sleep / behaviour",
};

const REPLAY_STEPS = [
  { label: "LIVE", ms: 0 },
  { label: "-15m", ms: 15 * 60_000 },
  { label: "-1h", ms: 60 * 60_000 },
  { label: "-3h", ms: 3 * 60 * 60_000 },
  { label: "-6h", ms: 6 * 60 * 60_000 },
];

function Dashboard({
  user,
  todayLog,
  today,
  logs,
}: {
  user: CrewMember;
  todayLog: DayLog | undefined;
  today: string;
  logs: Record<string, DayLog>;
}) {
  const now = useMissionClock();
  const [modelReady, setModelReady] = useState(false);
  const [replay, setReplay] = useState<{ at: number; label: string } | null>(() => {
    if (typeof window === "undefined") return null;
    const raw = Number(new URLSearchParams(window.location.search).get("t"));
    return Number.isFinite(raw) && raw > 0 ? { at: raw, label: "LINK" } : null;
  });
  const state = useHyperLife();

  useEffect(() => {
    let alive = true;
    loadWebModel().then((ok) => {
      if (alive) setModelReady(ok);
    });
    return () => {
      alive = false;
    };
  }, []);

  const at = replay?.at ?? now;
  const view = useMissionView(user, logs, at, modelReady ? 1 : 0);
  const snap = view.snapshot;
  const tips = useMemo(() => missionAdvice(snap), [snap]);
  const standings = useMemo(() => crewStandings(state, at), [state, at, modelReady]);
  const { brief, loading: briefLoading, refresh } = useMissionBrief(snap, view);

  return (
    <ScreenShell icon="dashboard" title="Health dashboard" user={user} energy={snap.score}>
      <div className="space-y-6">
        <LiveStrip
          snap={snap}
          replayAt={replay?.at ?? null}
          replayLabel={replay?.label ?? "LIVE"}
          onReplay={(next, label) => {
            setReplay(next === null ? null : { at: next, label });
            const url = new URL(window.location.href);
            if (next === null) url.searchParams.delete("t");
            else url.searchParams.set("t", String(next));
            window.history.replaceState({}, "", url);
          }}
          modelReady={modelReady}
        />

        {!isDayComplete(todayLog) && <LogPrompt user={user} todayLog={todayLog} snap={snap} />}

        <Panel
          kicker="Live vitals vs your baseline"
          action={
            <span
              className={cn(
                "pixel-label border-[3px] px-3 py-1",
                STATUS_TEXT[vitalStatus(view)],
                "border-current",
              )}
            >
              Wearable: {vitalStatus(view)}
            </span>
          }
        >
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
            {[view.vitals.hr, view.vitals.spo2, view.vitals.temp].map((v) => (
              <VitalCard key={v.key} v={v} />
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xl text-muted-foreground">
            <span>HRV <span className="text-foreground">{snap.vitals.hrv} ms</span></span>
            <span>Activity <span className="text-foreground">{Math.round(snap.vitals.activity)}/100</span></span>
            <span>Sleep <span className="text-foreground">{snap.behavior.sleepHours.toFixed(1)} h</span></span>
            <span>Dose <span className="text-foreground">{ENVIRONMENTS[snap.profile.environment].radiation} mSv/d</span></span>
          </div>
          <div className="mt-6 flex h-4 gap-[2px]">
            {view.timeline.map((s, i) => (
              <span key={i} className={cn("flex-1", STATUS_BG[s])} />
            ))}
          </div>
          <div className="mt-2 flex flex-col gap-2 text-xl text-muted-foreground md:flex-row md:items-center md:justify-between">
            <span>
              Wearable status over time: <span className="text-mint">green normal</span> ·{" "}
              <span className="text-gold">amber watch</span> · <span className="text-warn">red alert</span>
            </span>
            <div className="flex flex-wrap gap-2">
              {[view.vitals.hr, view.vitals.spo2, view.vitals.temp].map((v) => {
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

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.7fr]">
          <Panel kicker="Hazard risk now">
            <ul className="space-y-4">
              {(Object.keys(RISK_LABELS) as (keyof Risks)[]).map((k) => {
                const v = snap.risks[k];
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
            {(Object.keys(RISK_LABELS) as (keyof Risks)[]).some((k) => riskLevel(snap.risks[k]) !== "low") && (
              <div className="mt-5 space-y-1 text-lg leading-tight text-muted-foreground">
                {(Object.keys(RISK_LABELS) as (keyof Risks)[])
                  .filter((k) => riskLevel(snap.risks[k]) !== "low")
                  .map((k) => (
                    <p key={k}>
                      ⚠ {RISK_LABELS[k]}: {snap.risks[k]}% ·{" "}
                      {riskLevel(snap.risks[k]) === "high" ? "notify flight surgeon." : "keep an eye on it."}
                    </p>
                  ))}
              </div>
            )}
          </Panel>

          <Panel kicker="Risk trend" action={<span className="pixel-label text-muted-foreground">f(t) · 10 min steps</span>}>
            <PixelChart
              height={230}
              min={0}
              max={100}
              yTicks={[100, 50, 0]}
              refLines={[
                { value: 60, label: "high 60%" },
                { value: 30, label: "moderate 30%" },
              ]}
              markers={view.markers}
              xLabels={["-7 h", replay ? "replay" : "now"]}
              series={(Object.keys(RISK_LABELS) as (keyof Risks)[]).map((k) => ({
                values: view.trend[k],
                color: RISK_COLOR[k],
              }))}
            />
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xl">
              {(Object.keys(RISK_LABELS) as (keyof Risks)[]).map((k) => (
                <span key={k} className="flex items-center gap-2">
                  <span className="h-3 w-3" style={{ background: RISK_COLOR[k] }} />
                  {RISK_LABELS[k]} {snap.risks[k]}%
                </span>
              ))}
            </div>
          </Panel>
        </div>

        <ModelPanel snap={snap} modelReady={modelReady} />

        <BriefPanel
          brief={brief}
          loading={briefLoading}
          onRefresh={refresh}
          snap={snap}
        />

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

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
          <Panel kicker="Your crew score" className="text-center">
            <AvatarFrame user={user} size={96} className="mx-auto" />
            <p className="mt-4 text-8xl leading-none text-gold">
              {snap.score}
              <span className="text-2xl text-muted-foreground">/100</span>
            </p>
            <p className="pixel-label mt-3">
              Rank <span className="text-sky">{snap.rank}</span>
            </p>
            <p className="mt-4 text-lg leading-tight text-muted-foreground">
              Live score from the on-device model: lower hazard risk = higher score.
            </p>
            <p className="pixel-label mt-4 text-muted-foreground">
              Model composite {snap.composite}% · cardiac flag {Math.round(snap.hardware.cardiacEvent * 100)}%
            </p>
          </Panel>

          <Panel kicker="Crew leaderboard" title="Compare live scores">
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
                                {s.date === today ? "today" : (s.date ?? "no logs")} · {ENVIRONMENTS[s.user.environment].short}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 text-muted-foreground">{ENVIRONMENTS[s.user.environment].short}</td>
                        <td className="w-[38%] py-2">
                          {s.score === null ? (
                            <span className="text-muted-foreground">-</span>
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
            <p className="mt-3 text-lg leading-tight text-muted-foreground">
              Every row is evaluated from the same wall-clock schedule, so the leaderboard stays live between log entries.
            </p>
          </Panel>
        </div>
      </div>
    </ScreenShell>
  );
}

function vitalStatus(view: MissionView): VitalStatus {
  return view.timeline[view.timeline.length - 1] ?? "ok";
}

function LiveStrip({
  snap,
  replayAt,
  replayLabel,
  onReplay,
  modelReady,
}: {
  snap: MissionSnapshot;
  replayAt: number | null;
  replayLabel: string;
  onReplay: (at: number | null, label: string) => void;
  modelReady: boolean;
}) {
  const env = ENVIRONMENTS[snap.profile.environment];
  const scenarioRemaining = snap.scenario.active
    ? snap.scenario.windowEnd - snap.at
    : snap.scenario.nextAt - snap.at;
  return (
    <Panel
      kicker="Live mission · wall-clock timeline"
      action={
        <span
          className={cn(
            "pixel-label border-[3px] px-3 py-1",
            replayAt ? "border-gold text-gold" : "border-mint text-mint",
          )}
        >
          {replayAt ? "REPLAY" : "LIVE"} · {formatClock(snap.at)} UTC
        </span>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="border-[3px] border-panel-raised bg-space p-3">
          <p className="pixel-label text-sky">Mission clock</p>
          <p className="mt-2 text-3xl leading-none text-foreground">Day {snap.missionDay}</p>
          <p className="mt-1 text-lg leading-tight text-muted-foreground">
            {snap.phaseLabel} · {env.short}
          </p>
        </div>
        <div className="border-[3px] border-panel-raised bg-space p-3">
          <p className="pixel-label text-sky">Scenario</p>
          <p className="mt-2 text-2xl leading-none" style={{ color: SCENARIO_ACCENT[snap.scenario.scenario] }}>
            {SCENARIO_SHORT[snap.scenario.scenario]}
          </p>
          <p className="mt-1 text-lg leading-tight text-muted-foreground">
            {snap.scenario.active ? "ends" : "next"} in {formatDuration(scenarioRemaining)}
            {!snap.scenario.active && ` · ${SCENARIO_LABEL[snap.scenario.nextScenario]}`}
          </p>
        </div>
        <div className="border-[3px] border-panel-raised bg-space p-3">
          <p className="pixel-label text-sky">On-device model</p>
          <p className="mt-2 text-2xl leading-none text-foreground">
            {snap.hardware.source === "wasm" ? "WASM core" : "TS mirror"}
          </p>
          <p className="mt-1 text-lg leading-tight text-muted-foreground">
            int8 13-16-8-6 · {snap.hardware.inferenceUs} µs · v1.0
          </p>
          {!modelReady && <p className="mt-1 text-base text-gold">loading compiled core…</p>}
        </div>
        <div className="border-[3px] border-panel-raised bg-space p-3">
          <p className="pixel-label text-sky">Replay</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {REPLAY_STEPS.map((step) => {
              const active = step.label === replayLabel;
              return (
                <button
                  key={step.label}
                  type="button"
                  onClick={() => onReplay(step.ms === 0 ? null : Date.now() - step.ms, step.label)}
                  className={cn(
                    "pixel-label cursor-pointer border-2 px-2 py-1",
                    active ? "border-gold text-gold" : "border-panel-raised text-muted-foreground hover:text-foreground",
                  )}
                >
                  {step.label}
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-lg leading-tight text-muted-foreground">evaluates f(t), no stored telemetry</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-base leading-tight text-muted-foreground">
        <span>seed <span className="text-foreground">0x{snap.provenance.seed.toString(16)}</span></span>
        <span>epoch <span className="text-foreground">{snap.provenance.epochISO.slice(0, 10)}</span></span>
        <span>
          behaviour{" "}
          <span className="text-foreground">
            {snap.provenance.behaviorSource}
            {snap.provenance.behaviorDate ? ` · ${snap.provenance.behaviorDate}` : ""}
          </span>
        </span>
        <span>log completeness <span className="text-foreground">{snap.provenance.logCompleteness}/3</span></span>
        <span>model <span className="text-foreground">{snap.provenance.modelVersion}</span></span>
      </div>
    </Panel>
  );
}

function LogPrompt({ user, todayLog, snap }: { user: CrewMember; todayLog: DayLog | undefined; snap: MissionSnapshot }) {
  const done = completedLogs(todayLog);
  const items = [
    { to: "/mood" as const, label: "Mood form", done: done.mood },
    { to: "/food" as const, label: "Food diary", done: done.food },
    { to: "/health" as const, label: "General health form", done: done.health },
  ];
  const remaining = items.filter((i) => !i.done).length;
  return (
    <Panel kicker="Daily log" title="Sharpen today's brief">
      <p className="max-w-3xl text-2xl leading-tight text-muted-foreground">
        The live mission is running from{" "}
        <span className="text-foreground">
          {snap.provenance.behaviorSource === "nominal"
            ? "the nominal crew schedule"
            : `your ${snap.provenance.behaviorDate ?? "latest"} log`}
        </span>
        . {remaining} {remaining === 1 ? "form is" : "forms are"} still open today; logging them feeds your sleep, training,
        nutrition and symptom inputs into the next snapshot.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        {items.map((i) => (
          <Link
            key={i.to}
            to={i.to}
            className={cn(
              "pixel-label pixel-focus border-[3px] px-3 py-2",
              i.done ? "border-mint text-mint" : "border-pink text-pink hover:border-gold hover:text-gold",
            )}
          >
            {i.done ? "✓ " : "▶ "}
            {i.label}
          </Link>
        ))}
      </div>
      <p className="mt-3 text-lg leading-tight text-muted-foreground">
        Crew {user.crewId} · live view stays available while you log.
      </p>
    </Panel>
  );
}

function ModelPanel({ snap, modelReady }: { snap: MissionSnapshot; modelReady: boolean }) {
  return (
    <Panel
      kicker="On-device model · HyperWatch v1.0"
      title="Hardware risk domains"
      action={
        <span className={cn("pixel-label border-[3px] px-3 py-1", snap.hardware.source === "wasm" ? "border-mint text-mint" : "border-gold text-gold")}>
          {snap.hardware.source === "wasm" ? "WASM" : modelReady ? "MIRROR" : "BOOT"}
        </span>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {HW_KEYS.map((k) => {
          const fused = snap.hardware.fused[k];
          const lvl = riskLevel(fused);
          return (
            <div key={k} className="border-[3px] border-panel-raised bg-space p-3">
              <p className="pixel-label text-sky">{HW_LABEL[k]}</p>
              <p className={cn("mt-2 text-4xl leading-none", LEVEL_TEXT[lvl])}>{Math.round(fused)}%</p>
              <SegmentBar value={fused} max={100} segments={10} tone={LEVEL_BAR[lvl]} className="mt-2" height="h-2" />
              <p className="mt-2 text-base leading-tight text-muted-foreground">
                model {Math.round(snap.hardware.model[k])}% · rules {Math.round(snap.hardware.rule[k])}%
              </p>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-lg leading-tight text-muted-foreground">
        <span>
          Fused output = <span className="text-foreground">55% transparent rules + 45% int8 model</span>. These five domains
          drive the dashboard risks and the crew score.
        </span>
        <span className={cn(snap.hardware.cardiacEvent >= 0.55 ? "text-warn" : "text-muted-foreground")}>
          cardiac flag {Math.round(snap.hardware.cardiacEvent * 100)}% · inference {snap.hardware.inferenceUs} µs
        </span>
      </div>
      <p className="mt-2 text-base leading-tight text-muted-foreground">
        Research prototype decision support, not a medical device or a diagnosis.
      </p>
    </Panel>
  );
}

function BriefPanel({
  brief,
  loading,
  onRefresh,
  snap,
}: {
  brief: { text: string; source: "local-ai" | "endpoint" | "template" };
  loading: boolean;
  onRefresh: () => void;
  snap: MissionSnapshot;
}) {
  return (
    <Panel
      kicker={`Mission brief · ${briefSourceLabel(brief.source)}`}
      title="Today's summary"
      action={
        <button
          type="button"
          onClick={onRefresh}
          className="pixel-label pixel-focus cursor-pointer border-[3px] border-panel-raised px-3 py-2 text-muted-foreground hover:border-gold hover:text-gold"
        >
          {loading ? "THINKING_" : "REFRESH"}
        </button>
      }
    >
      <p className="max-w-5xl text-2xl leading-snug text-foreground">{brief.text}</p>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-lg leading-tight text-muted-foreground">
        <span>score <span className="text-gold">{snap.score}/100</span></span>
        <span>scenario <span style={{ color: SCENARIO_ACCENT[snap.scenario.scenario] }}>{SCENARIO_SHORT[snap.scenario.scenario]}</span></span>
        <span>data <span className="text-foreground">{snap.provenance.behaviorSource}</span></span>
        {brief.source === "template" && (
          <span className="text-muted-foreground">
            on-device AI unavailable in this browser; showing the facts-only template
          </span>
        )}
      </div>
    </Panel>
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
            baseline {v.baseline} · z-score{" "}
            <span className={STATUS_TEXT[s]}>
              {v.z >= 0 ? "+" : ""}
              {v.z}
            </span>
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
        xLabels={["-7 h", "now"]}
        series={[{ values: v.values, color }]}
      />
    </div>
  );
}
