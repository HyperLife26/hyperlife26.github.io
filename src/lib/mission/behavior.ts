import type { CrewMember, DayLog, Symptom } from "@/lib/hyperlife/types";
import {
  completedLogs,
  foodScore,
  foodTargets,
  isFoodLogged,
  moodFactors,
  healthFactors,
} from "@/lib/hyperlife/scoring";
import { clamp, dateKey, roundTo } from "./deterministic";
import type { MissionProfile } from "./profiles";

export type BehaviorSource = "logs" | "mixed" | "recent" | "nominal";

export interface MissionBehavior {
  sleepHours: number;
  exerciseMinutes: number;
  /** 0 calm .. 1 stressed */
  stress: number;
  workload: number;
  /** 0 good .. 1 poor */
  moodRisk: number;
  nutritionScore: number;
  hydration: number;
  symptoms: Symptom[];
  familyContact: "today" | "week" | "not-recently";
  source: BehaviorSource;
  logDate?: string;
  completeness: number;
}

function nominalBehavior(profile: MissionProfile, at: number, missionDay: number): MissionBehavior {
  const d = new Date(at);
  const hour = d.getUTCHours() + d.getUTCMinutes() / 60;
  const dayWave = Math.sin(missionDay * 0.63 + (profile.seed % 31));
  const workHours = hour >= 8 && hour < 18;
  const sleepHours = roundTo(clamp(profile.sleepTarget + dayWave * 0.22, 5.4, 8.4), 1);
  const exerciseMinutes = Math.round(clamp(42 * profile.activityBias + dayWave * 14, 15, 95));
  const stress = clamp(profile.stressBias + (workHours ? 0.07 : -0.04) + Math.sin(missionDay * 0.41 + hour / 5) * 0.09);
  const workload = Math.round(clamp(3.6 + stress * 6, 1, 10) * 10) / 10;
  const moodRisk = clamp(0.18 + stress * 0.36 + Math.max(0, 7 - sleepHours) * 0.035);
  const nutritionScore = Math.round(clamp(74 + dayWave * 9 + Math.cos(missionDay * 0.27) * 4, 45, 94));
  const hydration = roundTo(clamp(0.74 + Math.sin((hour / 24) * Math.PI * 2) * 0.1, 0.5, 0.95), 2);
  return {
    sleepHours,
    exerciseMinutes,
    stress,
    workload,
    moodRisk,
    nutritionScore,
    hydration,
    symptoms: [],
    familyContact: missionDay % 3 === 0 ? "today" : missionDay % 7 === 0 ? "not-recently" : "week",
    source: "nominal",
    completeness: 0,
  };
}

function recentLogFor(logs: Record<string, DayLog>, at: number) {
  const today = dateKey(at);
  for (let back = 0; back <= 3; back++) {
    const key = dateKey(at - back * 86_400_000);
    const day = logs[key];
    if (day && (day.mood || day.health || isFoodLogged(day.food))) {
      return { key, day, exact: key === today };
    }
  }
  return null;
}

function fromLog(
  user: CrewMember,
  profile: MissionProfile,
  at: number,
  missionDay: number,
  found: { key: string; day: DayLog; exact: boolean },
): MissionBehavior {
  const base = nominalBehavior(profile, at, missionDay);
  const { day } = found;
  const done = completedLogs(day);
  const completeness = [done.mood, done.food, done.health].filter(Boolean).length;
  const next: MissionBehavior = {
    ...base,
    source: found.exact ? (completeness === 3 ? "logs" : "mixed") : "recent",
    logDate: found.key,
    completeness,
  };

  if (day.mood) {
    const mf = moodFactors(day.mood);
    next.sleepHours = day.mood.sleepHours;
    next.workload = day.mood.workload;
    next.stress = clamp(0.55 * mf.stress + 0.25 * mf.workload + 0.2 * mf.feeling);
    next.moodRisk = clamp(
      0.22 * mf.feeling + 0.22 * mf.stress + 0.18 * mf.sleep + 0.12 * mf.workload + 0.1 * mf.family + 0.16 * mf.crew,
    );
    next.familyContact = day.mood.familyContact;
  }

  if (day.health) {
    const hf = healthFactors(day.health);
    next.exerciseMinutes = day.health.exercised ? day.health.exerciseMinutes : 0;
    next.symptoms = day.health.symptoms;
    next.stress = clamp(next.stress + hf.pain * 0.12);
    next.moodRisk = clamp(next.moodRisk + hf.pain * 0.08);
  }

  if (isFoodLogged(day.food)) {
    const targets = foodTargets(user);
    const score = foodScore(day.food, targets);
    next.nutritionScore = score.total;
    next.hydration = clamp((day.food?.waterMl ?? 0) / targets.waterMl);
  }

  return next;
}

export function behaviorFor(
  user: CrewMember,
  profile: MissionProfile,
  logs: Record<string, DayLog>,
  at: number,
  missionDay: number,
): MissionBehavior {
  const found = recentLogFor(logs, at);
  if (!found) return nominalBehavior(profile, at, missionDay);
  return fromLog(user, profile, at, missionDay, found);
}
