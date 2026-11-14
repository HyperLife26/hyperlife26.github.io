import { ENVIRONMENTS } from "@/lib/hyperlife/constants";
import type { CrewMember } from "@/lib/hyperlife/types";
import { hashString } from "./deterministic";

export type MissionPhase = "prelaunch" | "launch" | "transit" | "surface" | "return";

export interface MissionProfile {
  key: string;
  seed: number;
  age: number;
  sex: CrewMember["sex"];
  weightKg: number;
  heightCm: number;
  environment: CrewMember["environment"];
  gravityG: number;
  radiation: number;
  baseHr: number;
  baseHrv: number;
  baseSpo2: number;
  baseTemp: number;
  sleepTarget: number;
  stressBias: number;
  activityBias: number;
  knownCvd: boolean;
}

/** Fixed starts keep the demo timeline identical for every visitor. */
export const DEMO_MISSION_START: Record<string, string> = {
  "demo-orion": "2026-07-10",
  "demo-vega": "2026-09-29",
  "demo-kito": "2026-04-18",
};

export const DEMO_PROFILE: Record<string, { sleepTarget: number; stressBias: number; activityBias: number }> = {
  "demo-orion": { sleepTarget: 7.1, stressBias: 0.3, activityBias: 1.05 },
  "demo-vega": { sleepTarget: 6.4, stressBias: 0.42, activityBias: 0.92 },
  "demo-kito": { sleepTarget: 6.8, stressBias: 0.36, activityBias: 1.12 },
};

export function profileFor(user: CrewMember): MissionProfile {
  const seed = hashString(`${user.crewId}:${user.id}`);
  const env = ENVIRONMENTS[user.environment];
  const demo = DEMO_PROFILE[user.id];
  return {
    key: user.crewId,
    seed,
    age: user.age,
    sex: user.sex,
    weightKg: user.weightKg,
    heightCm: user.heightCm,
    environment: user.environment,
    gravityG: env.gravityG,
    radiation: env.radiation,
    baseHr: 59 + (user.age > 40 ? 3 : 0) + (user.sex === "female" ? 2 : 0) + ((seed >>> 3) % 5),
    baseHrv: 52 - Math.max(0, user.age - 30) * 0.35 + ((seed >>> 6) % 7) - 3,
    baseSpo2: 97.7 + ((seed >>> 9) % 3) * 0.1,
    baseTemp: 36.55 + ((seed >>> 12) % 3) * 0.04,
    sleepTarget: demo?.sleepTarget ?? 6.7 + ((seed >>> 5) % 10) / 10,
    stressBias: demo?.stressBias ?? 0.28 + ((seed >>> 7) % 18) / 100,
    activityBias: demo?.activityBias ?? 0.9 + ((seed >>> 11) % 26) / 100,
    knownCvd: user.age >= 55 && seed % 7 === 0,
  };
}

export function missionEpochMs(user: CrewMember) {
  return Date.parse(`${user.missionStart}T00:00:00Z`);
}

export function missionDayAt(user: CrewMember, at: number) {
  const epoch = missionEpochMs(user);
  if (!Number.isFinite(epoch)) return 1;
  return Math.max(1, Math.floor((at - epoch) / 86_400_000) + 1);
}

export function missionPhaseAt(user: CrewMember, day: number): MissionPhase {
  if (day <= 0) return "prelaunch";
  if (day === 1) return "launch";
  if (user.environment === "ship") return "transit";
  if (day <= 10) return "transit";
  return "surface";
}

export function gravityForPhase(profile: MissionProfile, phase: MissionPhase) {
  if (phase === "transit") return 0;
  if (phase === "surface") return profile.gravityG;
  return 1;
}

export const PHASE_LABEL: Record<MissionPhase, string> = {
  prelaunch: "Pre-launch",
  launch: "Launch",
  transit: "Transit",
  surface: "Surface ops",
  return: "Return",
};
