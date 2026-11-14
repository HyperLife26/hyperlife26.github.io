import { RISK_MODEL, RISK_MODEL_VERSION } from "./riskModelWeights";
import { clamp } from "./deterministic";

export interface HardwareInput {
  hr: number;
  hrv: number;
  spo2: number;
  temp: number;
  slope: number;
  activity: number;
  sleep: number;
  missionDay: number;
  gravity: number;
  dailyRad: number;
  age: number;
  knownCvd: boolean;
  symptom: boolean;
  cumulativeRad: number;
}

export interface HardwareRisks {
  cardio: number;
  bone: number;
  immune: number;
  radiation: number;
  sleep: number;
}

export interface HardwareEvaluation {
  /** 0-100 per domain */
  fused: HardwareRisks;
  /** raw int8 model head */
  model: HardwareRisks;
  /** transparent rule engine */
  rule: HardwareRisks;
  /** 0-1 acute cardiac-event probability */
  cardiacEvent: number;
  source: "wasm" | "fallback";
  version: string;
  inferenceUs: number;
}

const M = RISK_MODEL;

const roundHalfAwayFromZero = (x: number) => (x >= 0 ? Math.round(x) : -Math.round(-x));

function quantise(x: number, scale: number, zeroPoint: number) {
  return clamp(roundHalfAwayFromZero(x / scale) + zeroPoint, -128, 127);
}

function sigmoid(x: number) {
  if (x > 40) return 1;
  if (x < -40) return 0;
  return 1 / (1 + Math.exp(-x));
}

function featureVector(i: HardwareInput) {
  return [
    clamp((i.hr - 40) / 140),
    clamp(i.hrv / 120),
    clamp((i.spo2 - 85) / 15),
    clamp((i.temp - 34) / 6),
    clamp((i.slope + 0.5) / 1),
    clamp(i.activity / 100),
    clamp(i.sleep / 12),
    clamp(i.missionDay / 365),
    clamp(i.gravity),
    clamp(i.dailyRad / 5),
    clamp((i.age - 18) / 62),
    i.knownCvd ? 1 : 0,
    i.symptom ? 1 : 0,
  ];
}

function modelHead(i: HardwareInput) {
  const features = featureVector(i);
  const input = new Int8Array(M.INPUT_SIZE);
  for (let n = 0; n < M.INPUT_SIZE; n++) {
    input[n] = quantise(features[n]!, M.INPUT_SCALE, M.INPUT_ZERO_POINT);
  }

  const h1 = new Int8Array(M.HIDDEN1_SIZE);
  for (let o = 0; o < M.HIDDEN1_SIZE; o++) {
    let acc = M.B1[o]!;
    for (let n = 0; n < M.INPUT_SIZE; n++) {
      acc += (input[n]! - M.INPUT_ZERO_POINT) * M.W1[o * M.INPUT_SIZE + n]!;
    }
    const x = Math.max(0, acc * M.INPUT_SCALE * M.L1_W_SCALE);
    h1[o] = quantise(x, M.L1_OUT_SCALE, M.L1_OUT_ZERO_POINT);
  }

  const h2 = new Int8Array(M.HIDDEN2_SIZE);
  for (let o = 0; o < M.HIDDEN2_SIZE; o++) {
    let acc = M.B2[o]!;
    for (let n = 0; n < M.HIDDEN1_SIZE; n++) {
      acc += (h1[n]! - M.L1_OUT_ZERO_POINT) * M.W2[o * M.HIDDEN1_SIZE + n]!;
    }
    const x = Math.max(0, acc * M.L1_OUT_SCALE * M.L2_W_SCALE);
    h2[o] = quantise(x, M.L2_OUT_SCALE, M.L2_OUT_ZERO_POINT);
  }

  const logits = new Float64Array(M.OUTPUT_SIZE);
  for (let o = 0; o < M.OUTPUT_SIZE; o++) {
    let acc = M.B3[o]!;
    for (let n = 0; n < M.HIDDEN2_SIZE; n++) {
      acc += (h2[n]! - M.L2_OUT_ZERO_POINT) * M.W3[o * M.HIDDEN2_SIZE + n]!;
    }
    logits[o] = acc * M.L2_OUT_SCALE * M.L3_W_SCALE;
  }

  const risks: HardwareRisks = {
    cardio: sigmoid(logits[0]!) * 100,
    bone: sigmoid(logits[1]!) * 100,
    immune: sigmoid(logits[2]!) * 100,
    radiation: sigmoid(logits[3]!) * 100,
    sleep: sigmoid(logits[4]!) * 100,
  };
  return { risks, cardiacEvent: sigmoid(logits[5]!) };
}

function boneLossPercent(missionDay: number, gravity: number, activity: number, age: number) {
  const months = missionDay / 30;
  const exerciseMod = clamp(1 - activity / 250, 0.55, 1);
  const ageMod = 1 + (age > 40 ? (age - 40) * 0.012 : 0);
  return 1.25 * months * (1 - gravity) * exerciseMod * ageMod;
}

/** Exact port of RiskEngine::evaluateRules from the firmware. */
export function ruleHead(i: HardwareInput): { risks: HardwareRisks; cardiacEvent: number } {
  const hr = i.hr;
  const hrv = i.hrv;
  const spo2 = i.spo2;
  const temp = i.temp;
  const activity = i.activity;
  const sleep = i.sleep;
  const day = i.missionDay;
  const gravity = i.gravity;
  const dailyRad = i.dailyRad;
  const age = i.age;
  const cvd = i.knownCvd ? 1 : 0;
  const symptom = i.symptom ? 1 : 0;

  const hrRisk = clamp((Math.abs(hr - 72) - 12) * 1.5, 0, 40);
  const spo2Risk = clamp((96 - spo2) * 7, 0, 40);
  const hrvRisk = clamp((40 - hrv) * 0.7, 0, 18);
  const tempRisk = clamp((temp - 37.3) * 18, 0, 15);
  const decond = clamp((day / 180) * (1 - gravity) * 20, 0, 18);
  const ageRisk = clamp((age - 45) * 0.4, 0, 8);
  const cardio = clamp(hrRisk + spo2Risk + hrvRisk + tempRisk + decond + ageRisk + 12 * cvd, 0, 100);

  const bone = clamp(boneLossPercent(i.missionDay, gravity, activity, i.age) * 6.5, 0, 100);

  const tempDev = Math.abs(temp - 36.6);
  const immune = clamp(
    clamp(tempDev * 22, 0, 28) +
      clamp((7.5 - sleep) * 7, 0, 30) +
      clamp(dailyRad * 10, 0, 18) +
      clamp(day * 0.07, 0, 14) +
      clamp(activity * 0.08, 0, 8),
    0,
    100,
  );

  const acuteRad = clamp((dailyRad - 1) * 4, 0, 20);
  const radiation = clamp(clamp((i.cumulativeRad / 600) * 85, 0, 85) + clamp(dailyRad * 5, 0, 15) + acuteRad, 0, 100);

  const sleepRisk = clamp(
    clamp((8 - sleep) * 8, 0, 50) + clamp(day * 0.06, 0, 20) + clamp((activity - 55) * 0.5, 0, 15),
    0,
    100,
  );

  let acute = 0;
  if (hr > 140 || hr < 45) acute += 0.3;
  if (spo2 < 90) acute += 0.3;
  if (hrv < 15) acute += 0.15;
  if (temp > 38.5) acute += 0.1;
  if (cvd > 0.5) acute += 0.1;
  if (symptom > 0.5) acute += 0.35;
  acute += 0.1 * (cardio / 100);

  return {
    risks: { cardio, bone, immune, radiation, sleep: sleepRisk },
    cardiacEvent: clamp(acute),
  };
}

export function evaluateHardwareFallback(input: HardwareInput): HardwareEvaluation {
  const t0 = typeof performance !== "undefined" ? performance.now() : 0;
  const model = modelHead(input);
  const rule = ruleHead(input);
  const fused: HardwareRisks = {
    cardio: clamp(0.55 * rule.risks.cardio + 0.45 * model.risks.cardio, 0, 100),
    bone: clamp(0.55 * rule.risks.bone + 0.45 * model.risks.bone, 0, 100),
    immune: clamp(0.55 * rule.risks.immune + 0.45 * model.risks.immune, 0, 100),
    radiation: clamp(0.55 * rule.risks.radiation + 0.45 * model.risks.radiation, 0, 100),
    sleep: clamp(0.55 * rule.risks.sleep + 0.45 * model.risks.sleep, 0, 100),
  };
  let cardiacEvent = Math.max(rule.cardiacEvent, model.cardiacEvent);
  if (input.symptom) cardiacEvent = Math.max(cardiacEvent, 0.55);
  const t1 = typeof performance !== "undefined" ? performance.now() : 0;
  return {
    fused,
    model: model.risks,
    rule: rule.risks,
    cardiacEvent,
    source: "fallback",
    version: RISK_MODEL_VERSION,
    inferenceUs: Math.round((t1 - t0) * 1000),
  };
}
