import { ENVIRONMENTS } from "@/lib/hyperlife/constants";
import { RISK_LABELS, type Risks } from "@/lib/hyperlife/scoring";
import { hashString, roundTo } from "./deterministic";
import type { MissionSnapshot, MissionView } from "./snapshot";

export interface BriefFacts {
  crew: string;
  base: string;
  missionDay: number;
  phase: string;
  scenario: string;
  score: number;
  rank: string;
  topRisk: string;
  topRiskValue: number;
  secondRisk: string;
  secondRiskValue: number;
  hr: number;
  spo2: number;
  temp: number;
  hrv: number;
  sleepHours: number;
  exerciseMinutes: number;
  cardiacFlag: number;
  modelSource: string;
  dataSource: string;
  trendScore: number;
  trendHr: number;
}

export interface MissionBrief {
  text: string;
  source: "local-ai" | "endpoint" | "template";
  generatedAt: number;
}

export function briefFacts(snap: MissionSnapshot, view: MissionView): BriefFacts {
  const ordered = (Object.keys(snap.risks) as (keyof Risks)[])
    .map((key) => ({ key, value: snap.risks[key] }))
    .sort((a, b) => b.value - a.value);
  const top = ordered[0]!;
  const second = ordered[1]!;
  const env = ENVIRONMENTS[snap.profile.environment];
  return {
    crew: snap.profile.key,
    base: env.name,
    missionDay: snap.missionDay,
    phase: snap.phaseLabel,
    scenario: snap.scenario.label,
    score: snap.score,
    rank: snap.rank,
    topRisk: RISK_LABELS[top.key],
    topRiskValue: top.value,
    secondRisk: RISK_LABELS[second.key],
    secondRiskValue: second.value,
    hr: snap.vitals.hr,
    spo2: snap.vitals.spo2,
    temp: snap.vitals.temp,
    hrv: snap.vitals.hrv,
    sleepHours: roundTo(snap.behavior.sleepHours, 1),
    exerciseMinutes: snap.behavior.exerciseMinutes,
    cardiacFlag: Math.round(snap.hardware.cardiacEvent * 100),
    modelSource: snap.hardware.source === "wasm" ? "firmware WASM" : "model mirror",
    dataSource: snap.behavior.source === "nominal" ? "nominal schedule" : `daily log (${snap.behavior.source})`,
    trendScore: view.deltas.score,
    trendHr: view.deltas.hr,
  };
}

function priority(facts: BriefFacts) {
  if (facts.scenario !== "Nominal operations") return `priority is the ${facts.scenario.toLowerCase()}`;
  if (facts.sleepHours < 7) return "priority is sleep recovery";
  if (facts.exerciseMinutes < 45) return "priority is resistance loading";
  if (facts.topRiskValue >= 60) return `priority is ${facts.topRisk.toLowerCase()}`;
  return "priority is maintaining the current routine";
}

export function templateBrief(facts: BriefFacts): string {
  const direction =
    facts.trendScore > 2 ? "improving" : facts.trendScore < -2 ? "slipping" : "holding steady";
  return `${facts.crew} is on mission day ${facts.missionDay} at ${facts.base} during ${facts.phase.toLowerCase()}. Heart rate is ${facts.hr} bpm, SpO₂ ${facts.spo2}% and temperature ${facts.temp}°C, with ${facts.topRisk.toLowerCase()} the highest hazard at ${facts.topRiskValue}% and a crew score of ${facts.score}/100 (${facts.rank}), ${direction} over the last seven hours. ${facts.scenario === "Nominal operations" ? "No drill is active" : facts.scenario + " is active"}, so the ${priority(facts)}.`;
}

const BRIEF_SYSTEM =
  "You are the HyperLife mission briefing assistant. Write a factual 2-3 sentence brief of at most 65 words. Use ONLY the JSON facts supplied. Never diagnose, never give medical treatment advice, never invent numbers, and never describe how the underlying data was produced. Mention the crew id, mission day, the highest hazard and one priority action.";

function validate(text: string, facts: BriefFacts): string | null {
  const clean = text.trim().replace(/\s+/g, " ");
  if (clean.length < 40 || clean.length > 460) return null;
  if (/patient|diagnos|prescrib|medication dose/i.test(clean)) return null;
  if (/(as an ai|i cannot|i can't)/i.test(clean)) return null;
  if (!clean.includes(facts.crew)) return null;
  return clean;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

interface LanguageSession {
  prompt: (text: string) => Promise<string>;
  destroy?: () => void;
}

interface LanguageModelApi {
  create?: (options?: Record<string, unknown>) => Promise<LanguageSession>;
  availability?: () => Promise<string>;
  capabilities?: () => Promise<{ available?: string }>;
}

function browserLanguageModel(): LanguageModelApi | null {
  const g = globalThis as unknown as {
    LanguageModel?: LanguageModelApi;
    ai?: { languageModel?: LanguageModelApi };
  };
  return g.LanguageModel ?? g.ai?.languageModel ?? null;
}

let localAiUnavailable = false;
const cache = new Map<string, MissionBrief>();

export function clearBriefCache() {
  cache.clear();
  localAiUnavailable = false;
}

async function localAiBrief(facts: BriefFacts): Promise<string | null> {
  if (localAiUnavailable) return null;
  const api = browserLanguageModel();
  if (!api?.create) {
    localAiUnavailable = true;
    return null;
  }
  try {
    const availability = api.availability ? await api.availability() : (await api.capabilities?.())?.available;
    if (availability && !["available", "readily"].includes(availability)) {
      localAiUnavailable = true;
      return null;
    }
    const session = await api.create({ systemPrompt: BRIEF_SYSTEM, temperature: 0.2, topK: 3 });
    try {
      const text = await withTimeout(session.prompt(`Facts: ${JSON.stringify(facts)}`), 9000);
      return validate(text, facts);
    } finally {
      session.destroy?.();
    }
  } catch {
    localAiUnavailable = true;
    return null;
  }
}

async function endpointBrief(facts: BriefFacts): Promise<string | null> {
  const endpoint = import.meta.env["VITE_BRIEF_ENDPOINT"] as string | undefined;
  if (!endpoint) return null;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ facts, system: BRIEF_SYSTEM }),
      signal: AbortSignal.timeout(9000),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { text?: unknown };
    return typeof data.text === "string" ? validate(data.text, facts) : null;
  } catch {
    return null;
  }
}

export async function generateBrief(
  facts: BriefFacts,
  options: { preferAi?: boolean } = {},
): Promise<MissionBrief> {
  const now = Date.now();
  const key = `${facts.crew}:${hashString(JSON.stringify(facts))}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const fallback: MissionBrief = { text: templateBrief(facts), source: "template", generatedAt: now };
  if (options.preferAi === false) {
    cache.set(key, fallback);
    return fallback;
  }

  const remote = await endpointBrief(facts);
  if (remote) {
    const brief: MissionBrief = { text: remote, source: "endpoint", generatedAt: now };
    cache.set(key, brief);
    return brief;
  }

  const local = await localAiBrief(facts);
  if (local) {
    const brief: MissionBrief = { text: local, source: "local-ai", generatedAt: now };
    cache.set(key, brief);
    return brief;
  }

  cache.set(key, fallback);
  return fallback;
}

export function briefSourceLabel(source: MissionBrief["source"]) {
  if (source === "local-ai") return "ON-DEVICE AI";
  if (source === "endpoint") return "AI SERVICE";
  return "FACTS TEMPLATE";
}
