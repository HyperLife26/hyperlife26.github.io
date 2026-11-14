import type { Symptom } from "@/lib/hyperlife/types";
import { clamp, lerp, roundTo, valueNoise } from "./deterministic";
import type { MissionBehavior } from "./behavior";
import type { MissionProfile } from "./profiles";
import type { Scenario } from "./scenario";

export interface MissionVitalBaseline {
  hr: number;
  hrv: number;
  spo2: number;
  temp: number;
}

export interface MissionVitals {
  hr: number;
  hrv: number;
  spo2: number;
  temp: number;
  slope: number;
  activity: number;
  symptomFlag: boolean;
  sleepHours: number;
  baseline: MissionVitalBaseline;
  sd: MissionVitalBaseline;
}

export function generateVitals(
  profile: MissionProfile,
  behavior: MissionBehavior,
  at: number,
  scenario: Scenario,
  intensity: number,
): MissionVitals {
  const d = new Date(at);
  const hour = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
  const circadian = Math.sin((Math.PI * 2 * (hour - 9)) / 24);
  const asleep = hour >= 23 || hour < 6.4;
  const exerciseWindow = hour >= 17 && hour < 18.5 && behavior.exerciseMinutes > 0;
  const workWindow = hour >= 8 && hour < 18;
  const symptoms = new Set<Symptom>(behavior.symptoms);

  const slowHr = valueNoise(profile.seed + 11, at / 420_000);
  const fastHr = valueNoise(profile.seed + 23, at / 55_000);
  const slowSpo2 = valueNoise(profile.seed + 37, at / 600_000);
  const slowTemp = valueNoise(profile.seed + 43, at / 900_000);
  const slowActivity = valueNoise(profile.seed + 59, at / 360_000);

  let activity =
    20 +
    28 * Math.sin((Math.PI * 2 * (hour - 8)) / 24) +
    (workWindow ? 13 : 0) +
    (exerciseWindow ? 52 : 0) -
    (asleep ? 14 : 0);
  activity = clamp(activity * profile.activityBias + slowActivity * 7, 2, 100);

  let hr =
    profile.baseHr +
    circadian * 4.2 +
    behavior.stress * 11 +
    (activity - 35) * 0.16 +
    (asleep ? -5 : 0) +
    slowHr * 1.5 +
    fastHr * 0.8;
  if (symptoms.has("fatigue")) hr += 3.5;

  let hrv =
    profile.baseHrv -
    behavior.stress * 8 -
    activity * 0.07 +
    (asleep ? 5 : 0) +
    valueNoise(profile.seed + 67, at / 300_000) * 2.2;

  let spo2 =
    profile.baseSpo2 -
    (symptoms.has("congestion") ? 1.4 : 0) -
    (symptoms.has("fatigue") ? 0.35 : 0) -
    (exerciseWindow ? 0.2 : 0) +
    slowSpo2 * 0.12;

  let temp =
    profile.baseTemp +
    circadian * 0.12 +
    (exerciseWindow ? 0.15 : 0) +
    (symptoms.has("sore-throat") ? 0.45 : 0) +
    (symptoms.has("congestion") ? 0.3 : 0) +
    (symptoms.has("rash") ? 0.15 : 0) +
    slowTemp * 0.05;

  let symptomFlag = symptoms.size > 0;

  if (intensity > 0) {
    const k = clamp(intensity);
    if (scenario === "cardiac") {
      hr = lerp(hr, 138, k * 0.9);
      hrv = lerp(hrv, 12, k * 0.9);
      spo2 = lerp(spo2, 89, k);
      temp = lerp(temp, 37.9, k * 0.9);
      symptomFlag = symptomFlag || k > 0.2;
    } else if (scenario === "radiation") {
      temp = lerp(temp, 37.2, k * 0.65);
      spo2 = lerp(spo2, 96.2, k * 0.35);
    } else if (scenario === "bone") {
      activity = lerp(activity, 8, k * 0.8);
      hr = lerp(hr, profile.baseHr + 2, k * 0.5);
    } else if (scenario === "immune") {
      temp = lerp(temp, 38.4, k * 0.8);
      hr = lerp(hr, 96, k * 0.65);
      hrv = lerp(hrv, 28, k * 0.65);
      symptomFlag = symptomFlag || k > 0.22;
    }
  }

  const slope = clamp((temp - profile.baseTemp) * 0.18 + valueNoise(profile.seed + 71, at / 240_000) * 0.02, -0.5, 0.5);

  return {
    hr: roundTo(clamp(hr, 35, 190), 1),
    hrv: roundTo(clamp(hrv, 5, 130), 1),
    spo2: roundTo(clamp(spo2, 80, 100), 1),
    temp: roundTo(clamp(temp, 34, 41), 2),
    slope: roundTo(slope, 3),
    activity: roundTo(clamp(activity, 0, 100), 1),
    symptomFlag,
    sleepHours: behavior.sleepHours,
    baseline: {
      hr: profile.baseHr,
      hrv: profile.baseHrv,
      spo2: profile.baseSpo2,
      temp: profile.baseTemp,
    },
    sd: { hr: 8, hrv: 8, spo2: 0.6, temp: 0.3 },
  };
}
