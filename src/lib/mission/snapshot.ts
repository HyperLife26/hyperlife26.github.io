import type { DayLog } from "@/lib/hyperlife/types";
import type { CrewMember } from "@/lib/hyperlife/types";
import {
  crewScore,
  rankFor,
  statusForZ,
  type Rank,
  type Risks,
  type VitalSeries,
  type VitalStatus,
} from "@/lib/hyperlife/scoring";
import { clamp, roundTo, utcDayFraction } from "./deterministic";
import { behaviorFor, type MissionBehavior } from "./behavior";
import { evaluateHardware } from "./modelRuntime";
import type { HardwareEvaluation } from "./int8Model";
import {
  gravityForPhase,
  missionDayAt,
  missionEpochMs,
  missionPhaseAt,
  PHASE_LABEL,
  profileFor,
  type MissionPhase,
  type MissionProfile,
} from "./profiles";
import { scenarioAt, SCENARIO_SHORT, type ScenarioState } from "./scenario";
import { generateVitals, type MissionVitals } from "./vitals";

export interface MissionProvenance {
  seed: number;
  epochISO: string;
  scheduleEpochISO: string;
  modelVersion: string;
  modelSource: "wasm" | "fallback";
  behaviorSource: MissionBehavior["source"];
  behaviorDate?: string | undefined;
  logCompleteness: number;
  scenario: string;
}

export interface MissionSnapshot {
  at: number;
  tick: number;
  missionDay: number;
  dayFraction: number;
  phase: MissionPhase;
  phaseLabel: string;
  scenario: ScenarioState;
  profile: MissionProfile;
  vitals: MissionVitals;
  behavior: MissionBehavior;
  hardware: HardwareEvaluation;
  risks: Risks;
  score: number;
  rank: Rank;
  composite: number;
  provenance: MissionProvenance;
}

export interface MissionPoint {
  at: number;
  hr: number;
  hrv: number;
  spo2: number;
  temp: number;
  score: number;
  risks: Risks;
  scenario: MissionSnapshot["scenario"]["scenario"];
  active: boolean;
  intensity: number;
}

export interface MissionView {
  snapshot: MissionSnapshot;
  points: MissionPoint[];
  vitals: { hr: VitalSeries; spo2: VitalSeries; temp: VitalSeries };
  trend: Record<keyof Risks, number[]>;
  timeline: VitalStatus[];
  markers: { position: number; label: string }[];
  deltas: { score: number; hr: number; spo2: number; temp: number };
}

function hardwareRisksToDashboard(hardware: HardwareEvaluation, behavior: MissionBehavior): Risks {
  const nutrition = Math.round(clamp(100 - behavior.nutritionScore, 0, 100));
  const mental = Math.round(clamp(hardware.fused.sleep * 0.72 + behavior.moodRisk * 28, 0, 100));
  const immune = Math.round(clamp(hardware.fused.immune * 0.8 + hardware.fused.radiation * 0.2, 0, 100));
  return {
    cardiovascular: Math.round(clamp(hardware.fused.cardio, 0, 100)),
    bone: Math.round(clamp(hardware.fused.bone, 0, 100)),
    nutrition,
    immune,
    mental,
  };
}

export function buildSnapshot(
  user: CrewMember,
  logs: Record<string, DayLog>,
  at: number = Date.now(),
): MissionSnapshot {
  const profile = profileFor(user);
  const missionDay = missionDayAt(user, at);
  const phase = missionPhaseAt(user, missionDay);
  const scenario = scenarioAt(user, at);
  const behavior = behaviorFor(user, profile, logs, at, missionDay);
  const vitals = generateVitals(profile, behavior, at, scenario.scenario, scenario.intensity);
  const gravity = gravityForPhase(profile, phase);
  const radiation = profile.radiation * (scenario.scenario === "radiation" ? 1 + 9 * scenario.intensity : 1);
  const cumulativeRad = profile.radiation * missionDay + (scenario.scenario === "radiation" ? radiation * 0.5 : 0);

  const hardware = evaluateHardware({
    hr: vitals.hr,
    hrv: vitals.hrv,
    spo2: vitals.spo2,
    temp: vitals.temp,
    slope: vitals.slope,
    activity: vitals.activity,
    sleep: behavior.sleepHours,
    missionDay,
    gravity,
    dailyRad: radiation,
    age: profile.age,
    knownCvd: profile.knownCvd,
    symptom: vitals.symptomFlag,
    cumulativeRad,
  });

  const risks = hardwareRisksToDashboard(hardware, behavior);
  const score = crewScore(risks);
  const composite =
    0.3 * hardware.fused.cardio +
    0.2 * hardware.fused.bone +
    0.2 * hardware.fused.immune +
    0.15 * hardware.fused.radiation +
    0.15 * hardware.fused.sleep;

  return {
    at,
    tick: Math.floor(at / 1000),
    missionDay,
    dayFraction: utcDayFraction(at),
    phase,
    phaseLabel: PHASE_LABEL[phase],
    scenario,
    profile,
    vitals,
    behavior,
    hardware,
    risks,
    score,
    rank: rankFor(score),
    composite: roundTo(composite, 1),
    provenance: {
      seed: profile.seed,
      epochISO: new Date(missionEpochMs(user)).toISOString(),
      scheduleEpochISO: new Date(Date.UTC(2026, 0, 1)).toISOString(),
      modelVersion: hardware.version,
      modelSource: hardware.source,
      behaviorSource: behavior.source,
      behaviorDate: behavior.logDate,
      logCompleteness: behavior.completeness,
      scenario: scenario.scenario,
    },
  };
}

function vitalSeries(
  key: VitalSeries["key"],
  label: string,
  unit: string,
  values: number[],
  baseline: number,
  sd: number,
  pad: number,
): VitalSeries {
  const current = values[values.length - 1] ?? baseline;
  const lo = Math.min(...values, baseline - sd * 2);
  const hi = Math.max(...values, baseline + sd * 2);
  return {
    key,
    label,
    unit,
    baseline: roundTo(baseline, 1),
    sd,
    values,
    current,
    z: roundTo((current - baseline) / sd, 1),
    min: roundTo(lo - pad, 1),
    max: roundTo(hi + pad, 1),
  };
}

/**
 * Replay comes from evaluating f(t), not from stored telemetry. Every point in
 * the chart is a full, fresh model inference from the deterministic schedule.
 */
export function buildMissionView(
  user: CrewMember,
  logs: Record<string, DayLog>,
  at: number = Date.now(),
  points = 42,
  stepMs = 10 * 60 * 1000,
): MissionView {
  const series: MissionSnapshot[] = [];
  for (let i = points - 1; i >= 0; i--) {
    series.push(buildSnapshot(user, logs, at - i * stepMs));
  }
  const current = series[series.length - 1]!;
  const first = series[0]!;

  const hr = vitalSeries("hr", "Heart rate", "bpm", series.map((s) => s.vitals.hr), current.vitals.baseline.hr, current.vitals.sd.hr, 2);
  const spo2 = vitalSeries("spo2", "SpO₂", "%", series.map((s) => s.vitals.spo2), current.vitals.baseline.spo2, current.vitals.sd.spo2, 0.3);
  const temp = vitalSeries("temp", "Body temperature", "°C", series.map((s) => s.vitals.temp), current.vitals.baseline.temp, current.vitals.sd.temp, 0.2);

  const trend = {
    cardiovascular: series.map((s) => s.risks.cardiovascular),
    bone: series.map((s) => s.risks.bone),
    nutrition: series.map((s) => s.risks.nutrition),
    immune: series.map((s) => s.risks.immune),
    mental: series.map((s) => s.risks.mental),
  };

  const timeline: VitalStatus[] = series.map((s) => {
    const zs = [
      Math.abs((s.vitals.hr - s.vitals.baseline.hr) / s.vitals.sd.hr),
      Math.abs((s.vitals.spo2 - s.vitals.baseline.spo2) / s.vitals.sd.spo2),
      Math.abs((s.vitals.temp - s.vitals.baseline.temp) / s.vitals.sd.temp),
    ];
    return statusForZ(Math.max(...zs));
  });

  const markers: { position: number; label: string }[] = [];
  let wasActive = false;
  series.forEach((s, i) => {
    if (s.scenario.active && (!wasActive || i === series.length - 1)) {
      markers.push({ position: i / Math.max(1, series.length - 1), label: SCENARIO_SHORT[s.scenario.scenario] });
    }
    wasActive = s.scenario.active;
  });

  return {
    snapshot: current,
    points: series.map((s) => ({
      at: s.at,
      hr: s.vitals.hr,
      hrv: s.vitals.hrv,
      spo2: s.vitals.spo2,
      temp: s.vitals.temp,
      score: s.score,
      risks: s.risks,
      scenario: s.scenario.scenario,
      active: s.scenario.active,
      intensity: s.scenario.intensity,
    })),
    vitals: { hr, spo2, temp },
    trend,
    timeline,
    markers,
    deltas: {
      score: current.score - first.score,
      hr: roundTo(current.vitals.hr - first.vitals.hr, 1),
      spo2: roundTo(current.vitals.spo2 - first.vitals.spo2, 1),
      temp: roundTo(current.vitals.temp - first.vitals.temp, 2),
    },
  };
}
