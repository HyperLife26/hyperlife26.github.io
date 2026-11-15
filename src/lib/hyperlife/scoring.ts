import { ENVIRONMENTS } from "./constants";
import type { CrewMember, DayLog, FoodLog, HealthLog, Meal, MoodLog } from "./types";

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

/* ---------------- daily completion ---------------- */

export function isFoodLogged(food?: FoodLog) {
  return !!food && Object.values(food.meals).some(Boolean);
}

export function completedLogs(day?: DayLog) {
  return {
    mood: !!day?.mood,
    health: !!day?.health,
    food: isFoodLogged(day?.food),
  };
}

/** Dashboard unlocks only when mood, general health and food are all logged. */
export function isDayComplete(day?: DayLog): day is Required<DayLog> {
  const c = completedLogs(day);
  return c.mood && c.health && c.food;
}

/* ---------------- food ---------------- */

export interface FoodTargets {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugarMax: number;
  waterMl: number;
}

export function foodTargets(user: Pick<CrewMember, "sex" | "weightKg" | "heightCm" | "age">): FoodTargets {
  const sexAdj = user.sex === "male" ? 5 : user.sex === "female" ? -161 : -78;
  const bmr = 10 * user.weightKg + 6.25 * user.heightCm - 5 * user.age + sexAdj;
  const kcal = Math.round((bmr * 1.5) / 50) * 50;
  return {
    kcal,
    protein: Math.round(user.weightKg * 1.2),
    carbs: Math.round((kcal * 0.5) / 4),
    fat: Math.round((kcal * 0.3) / 9),
    fiber: user.sex === "male" ? 30 : 25,
    sugarMax: 50,
    waterMl: 2500,
  };
}

export function foodTotals(food?: FoodLog): Meal {
  const meals = Object.values(food?.meals ?? {}).filter(Boolean) as Meal[];
  return meals.reduce(
    (acc, m) => ({
      name: "total",
      kcal: acc.kcal + m.kcal,
      protein: acc.protein + m.protein,
      carbs: acc.carbs + m.carbs,
      fat: acc.fat + m.fat,
      fiber: acc.fiber + m.fiber,
      sugar: acc.sugar + m.sugar,
    }),
    { name: "total", kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 },
  );
}

export interface FoodScore {
  total: number;
  parts: {
    calories: number;
    protein: number;
    water: number;
    lowSugar: number;
    fiber: number;
    supplements: number;
  };
}

export const FOOD_SCORE_MAX = {
  calories: 30,
  protein: 20,
  water: 20,
  lowSugar: 10,
  fiber: 10,
  supplements: 10,
} as const;

export function foodScore(food: FoodLog | undefined, t: FoodTargets): FoodScore {
  const tot = foodTotals(food);
  const hasMeals = isFoodLogged(food);
  const parts = {
    calories: hasMeals
      ? Math.round(FOOD_SCORE_MAX.calories * clamp(1 - Math.abs(tot.kcal - t.kcal) / t.kcal))
      : 0,
    protein: Math.round(FOOD_SCORE_MAX.protein * clamp(tot.protein / t.protein)),
    water: Math.round(FOOD_SCORE_MAX.water * clamp((food?.waterMl ?? 0) / t.waterMl)),
    lowSugar: hasMeals
      ? Math.round(FOOD_SCORE_MAX.lowSugar * clamp(1 - Math.max(0, tot.sugar - t.sugarMax) / t.sugarMax))
      : 0,
    fiber: Math.round(FOOD_SCORE_MAX.fiber * clamp(tot.fiber / t.fiber)),
    supplements: food?.supplements ? FOOD_SCORE_MAX.supplements : 0,
  };
  const total = Object.values(parts).reduce((a, b) => a + b, 0);
  return { total, parts };
}

export type Rank = "S" | "A" | "B" | "C" | "D";
export function rankFor(score: number): Rank {
  if (score >= 90) return "S";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  return "D";
}

/* ---------------- seeded randomness ---------------- */

export function hashString(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function seededRandom(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------- normalized "badness" factors (0 good .. 1 bad) ---------------- */

export function moodFactors(m: MoodLog) {
  return {
    feeling: (5 - m.feeling) / 4,
    stress: (5 - m.calm) / 4,
    sleep: clamp((7.5 - m.sleepHours) / 4.5),
    workload: clamp((m.workload - 5) / 5),
    family: m.familyContact === "today" ? 0 : m.familyContact === "week" ? 0.3 : 1,
    crew: (5 - m.crewRelationship) / 4,
  };
}

export function healthFactors(h: HealthLog) {
  const minutes = h.exercised ? h.exerciseMinutes : 0;
  return {
    exercise: clamp(1 - minutes / 90),
    pain: clamp(h.painLevel / 10),
    symptoms: h.symptoms.length / 4,
  };
}

/* ---------------- vitals (wearable feed) ---------------- */

export interface VitalSeries {
  key: "hr" | "spo2" | "temp";
  label: string;
  unit: string;
  baseline: number;
  sd: number;
  values: number[];
  current: number;
  z: number;
  min: number;
  max: number;
}

export type VitalStatus = "ok" | "watch" | "alert";
export const statusForZ = (z: number): VitalStatus =>
  Math.abs(z) < 1.5 ? "ok" : Math.abs(z) < 2.5 ? "watch" : "alert";

export const VITAL_POINTS = 42;

export function deriveVitals(user: CrewMember, day: Required<DayLog>, dateKey: string) {
  const rand = seededRandom(hashString(`${user.id}:${dateKey}`));
  const mf = moodFactors(day.mood);
  const hf = healthFactors(day.health);
  const s = new Set(day.health.symptoms);

  const hrBase = 62 + (user.age > 40 ? 3 : 0) + (user.sex === "female" ? 2 : 0);
  const hrShift = mf.stress * 12 + mf.sleep * 5 + hf.symptoms * 6 + (s.has("fatigue") ? 3 : 0) - (1 - hf.exercise) * 2;
  const spoBase = 97.8;
  const spoShift = -(s.has("congestion") ? 1.4 : 0) - (s.has("fatigue") ? 0.4 : 0) - mf.sleep * 0.4;
  const tBase = 36.4;
  const tShift = (s.has("sore-throat") ? 0.45 : 0) + (s.has("congestion") ? 0.3 : 0) + (s.has("rash") ? 0.15 : 0);

  const ramp = (i: number) => 1 / (1 + Math.exp(-(i / (VITAL_POINTS - 1) - 0.45) * 10));

  const build = (base: number, shift: number, noise: number, digits: number) => {
    const out: number[] = [];
    let drift = 0;
    for (let i = 0; i < VITAL_POINTS; i++) {
      drift = drift * 0.7 + (rand() - 0.5) * noise;
      const v = base + shift * ramp(i) + drift;
      out.push(Number(v.toFixed(digits)));
    }
    return out;
  };

  const mk = (
    key: VitalSeries["key"],
    label: string,
    unit: string,
    baseline: number,
    sd: number,
    values: number[],
    pad: number,
  ): VitalSeries => {
    const current = values[values.length - 1];
    const lo = Math.min(...values, baseline - sd * 2);
    const hi = Math.max(...values, baseline + sd * 2);
    return {
      key,
      label,
      unit,
      baseline,
      sd,
      values,
      current,
      z: Number(((current - baseline) / sd).toFixed(1)),
      min: Number((lo - pad).toFixed(1)),
      max: Number((hi + pad).toFixed(1)),
    };
  };

  const hr = mk("hr", "Heart rate", "bpm", hrBase, 5, build(hrBase, hrShift, 3, 0), 2);
  const spo2 = mk("spo2", "SpO₂", "%", spoBase, 0.6, build(spoBase, spoShift, 0.35, 1), 0.3);
  const temp = mk("temp", "Body temperature", "°C", tBase, 0.25, build(tBase, tShift, 0.08, 1), 0.2);

  const timeline: VitalStatus[] = hr.values.map((_, i) => {
    const zs = [
      (hr.values[i] - hr.baseline) / hr.sd,
      (spo2.values[i] - spo2.baseline) / spo2.sd,
      (temp.values[i] - temp.baseline) / temp.sd,
    ];
    return statusForZ(Math.max(...zs.map(Math.abs)));
  });

  return { hr, spo2, temp, timeline };
}

/* ---------------- hazard risks ---------------- */

export interface Risks {
  cardiovascular: number;
  bone: number;
  nutrition: number;
  immune: number;
  mental: number;
}

export const RISK_LABELS: Record<keyof Risks, string> = {
  cardiovascular: "Cardiovascular",
  bone: "Bone density loss",
  nutrition: "Nutrition",
  immune: "Immune status change",
  mental: "Mental / behavioral",
};

export type RiskLevel = "low" | "moderate" | "high";
export const riskLevel = (v: number): RiskLevel => (v < 30 ? "low" : v < 60 ? "moderate" : "high");

export function computeRisks(user: CrewMember, day: Required<DayLog>, hrZ = 0): Risks {
  const env = ENVIRONMENTS[user.environment];
  const mf = moodFactors(day.mood);
  const hf = healthFactors(day.health);
  const lowG = 1 - env.gravityG; // 1 = microgravity
  const rad = clamp(env.radiation / 2);
  const fs = foodScore(day.food, foodTargets(user)).total;
  const tot = foodTotals(day.food);
  const lowProtein = clamp(1 - tot.protein / (user.weightKg * 1.2));

  const pct = (v: number) => Math.round(clamp(v) * 100);

  return {
    mental: pct(
      0.22 * mf.feeling + 0.22 * mf.stress + 0.18 * mf.sleep + 0.12 * mf.workload + 0.1 * mf.family + 0.16 * mf.crew,
    ),
    nutrition: pct(((100 - fs) / 100) * 0.9),
    cardiovascular: pct(
      0.35 * hf.exercise + 0.2 * mf.stress + 0.1 * mf.sleep + 0.15 * lowG + 0.2 * clamp((hrZ - 0.5) / 3),
    ),
    bone: pct(0.4 * lowG * (0.4 + 0.6 * hf.exercise) + 0.3 * hf.exercise + 0.15 * hf.pain + 0.15 * lowProtein),
    immune: pct(0.4 * hf.symptoms + 0.2 * mf.sleep + 0.2 * mf.stress + 0.2 * rad),
  };
}

const RISK_WEIGHTS: Record<keyof Risks, number> = {
  cardiovascular: 0.25,
  bone: 0.2,
  nutrition: 0.2,
  immune: 0.15,
  mental: 0.2,
};

/** Crew score 0-100 generated from the dashboard hazard risks (higher = healthier). */
export function crewScore(r: Risks) {
  const weighted = (Object.keys(RISK_WEIGHTS) as (keyof Risks)[]).reduce(
    (acc, k) => acc + r[k] * RISK_WEIGHTS[k],
    0,
  );
  return Math.round(100 - weighted);
}

/** Full dashboard evaluation for one complete day. */
export function evaluateDay(user: CrewMember, day: Required<DayLog>, dateKey: string) {
  const vitals = deriveVitals(user, day, dateKey);
  const risks = computeRisks(user, day, vitals.hr.z);
  const score = crewScore(risks);
  return { vitals, risks, score, rank: rankFor(score) };
}

/** Intraday risk trend ending at current risk values. */
export function riskTrend(user: CrewMember, risks: Risks, dateKey: string) {
  const rand = seededRandom(hashString(`trend:${user.id}:${dateKey}`));
  const out = {} as Record<keyof Risks, number[]>;
  (Object.keys(risks) as (keyof Risks)[]).forEach((k) => {
    const end = risks[k];
    const start = Math.max(0, end * (0.35 + rand() * 0.4));
    const vals: number[] = [];
    let jitter = 0;
    for (let i = 0; i < VITAL_POINTS; i++) {
      const p = i / (VITAL_POINTS - 1);
      const stepP = Math.round(p * 6) / 6; // step-y progression = pixel feel
      jitter = rand() < 0.15 ? (rand() - 0.5) * 12 : jitter * 0.5;
      const v = i === VITAL_POINTS - 1 ? end : start + (end - start) * stepP + jitter;
      vals.push(Math.round(clamp(v, 0, 100)));
    }
    out[k] = vals;
  });
  return out;
}

/* ---------------- suggestions ---------------- */

export interface Suggestion {
  tone: "warn" | "tip" | "good";
  title: string;
  text: string;
}

export function buildSuggestions(user: CrewMember, day: Required<DayLog>, risks: Risks): Suggestion[] {
  const env = ENVIRONMENTS[user.environment];
  const mf = moodFactors(day.mood);
  const hf = healthFactors(day.health);
  const t = foodTargets(user);
  const tot = foodTotals(day.food);
  const out: Suggestion[] = [];

  if (hf.exercise > 0.3)
    out.push({
      tone: "warn",
      title: "Hit the treadmill",
      text: `Only ${day.health.exercised ? day.health.exerciseMinutes : 0} min logged. Aim for 90 min of resistance + cardio to protect bones and heart in ${env.gravityG === 0 ? "microgravity" : `${env.gravityG}g`}.`,
    });
  if (day.mood.sleepHours < 7)
    out.push({
      tone: "warn",
      title: "Recharge your sleep",
      text: `${day.mood.sleepHours}h is below the 7–8h target. Dim cabin lights 1h before rest and keep the sleep station cool.`,
    });
  if (mf.stress >= 0.5 || mf.workload >= 0.6)
    out.push({
      tone: "tip",
      title: "Lower the pressure",
      text: "Stress and workload are high. Schedule a 10 min breathing break and flag tasks to mission control for rebalancing.",
    });
  if (mf.family >= 0.3)
    out.push({
      tone: "tip",
      title: "Call home",
      text: "It's been a while since you contacted family. Book a private comms window this week.",
    });
  if (mf.crew >= 0.5)
    out.push({
      tone: "tip",
      title: "Crew check-in",
      text: "Crew relations feel strained. Try a shared meal or a debrief with the commander.",
    });
  if (day.food.waterMl < t.waterMl * 0.8)
    out.push({
      tone: "warn",
      title: "Hydrate",
      text: `Water at ${day.food.waterMl} ml of ${t.waterMl} ml. Fluid shifts in low gravity make dehydration easy to miss.`,
    });
  if (tot.protein < t.protein * 0.8)
    out.push({
      tone: "tip",
      title: "More protein",
      text: `${tot.protein} g of ${t.protein} g protein. Add an egg, tuna or nut pack to slow muscle loss.`,
    });
  if (tot.sugar > t.sugarMax)
    out.push({
      tone: "tip",
      title: "Cut the sugar",
      text: `${tot.sugar} g sugar today (limit ${t.sugarMax} g). Swap pudding for fruit or nuts.`,
    });
  if (!day.food.supplements)
    out.push({
      tone: "tip",
      title: "Vitamin D",
      text: "No supplements logged. Vitamin D + calcium help counter bone loss without sunlight.",
    });
  if (day.health.symptoms.length > 0)
    out.push({
      tone: "warn",
      title: "Report symptoms",
      text: `Symptoms logged: ${day.health.symptoms.join(", ").replace(/-/g, " ")}. Notify the flight surgeon and monitor temperature.`,
    });
  if (day.health.painLevel >= 6)
    out.push({
      tone: "warn",
      title: "Back & joints",
      text: "Pain level is high. Use the spinal stretch routine and check your exercise harness fit.",
    });
  if (env.radiation > 1)
    out.push({
      tone: "tip",
      title: "Radiation shelter",
      text: `${env.radiation} mSv/day here. Sleep in the shielded module and watch for solar particle alerts.`,
    });
  if (out.length < 3 && risks.mental < 30)
    out.push({ tone: "good", title: "Great vibes", text: "Mood and crew morale look strong. Keep the routine going!" });
  if (out.length < 3)
    out.push({ tone: "good", title: "On track", text: "Vitals are steady. Log tomorrow to keep your streak alive." });

  return out.slice(0, 6);
}
