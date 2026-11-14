import type { CrewMember } from "@/lib/hyperlife/types";
import { hashString, smoothstep } from "./deterministic";

export type Scenario = "nominal" | "cardiac" | "radiation" | "bone" | "immune";

export const SCENARIOS: Exclude<Scenario, "nominal">[] = ["cardiac", "radiation", "bone", "immune"];

export const SCENARIO_LABEL: Record<Scenario, string> = {
  nominal: "Nominal operations",
  cardiac: "Cardiac response drill",
  radiation: "Radiation storm drill",
  bone: "Bone-load drill",
  immune: "Immune flare drill",
};

export const SCENARIO_SHORT: Record<Scenario, string> = {
  nominal: "NOMINAL",
  cardiac: "CARDIAC",
  radiation: "RADIATION",
  bone: "BONE",
  immune: "IMMUNE",
};

export const SCENARIO_ACCENT: Record<Scenario, string> = {
  nominal: "var(--sky)",
  cardiac: "var(--pink)",
  radiation: "var(--peach)",
  bone: "var(--gold)",
  immune: "var(--mint)",
};

/** Shared schedule anchor: every visitor sees the same drills at the same time. */
export const SCHEDULE_EPOCH_MS = Date.UTC(2026, 0, 1, 0, 0, 0);
export const SLOT_MS = 2 * 60 * 60 * 1000;
export const DRILL_MS = 30 * 60 * 1000;
const CREWS = 3;

export interface ScenarioState {
  scenario: Scenario;
  label: string;
  active: boolean;
  intensity: number;
  windowStart: number;
  windowEnd: number;
  nextAt: number;
  nextScenario: Scenario;
}

function scenarioForSlot(slot: number): Exclude<Scenario, "nominal"> {
  return SCENARIOS[((Math.floor(slot / CREWS) % SCENARIOS.length) + SCENARIOS.length) % SCENARIOS.length]!;
}

export function scenarioAt(user: CrewMember, at: number): ScenarioState {
  const elapsed = at - SCHEDULE_EPOCH_MS;
  const slot = Math.floor(elapsed / SLOT_MS);
  const inSlot = elapsed - slot * SLOT_MS;
  const offset = hashString(user.crewId) % CREWS;
  const activeCrew = ((slot % CREWS) + CREWS) % CREWS === offset;
  const windowStart = SCHEDULE_EPOCH_MS + slot * SLOT_MS + (SLOT_MS - DRILL_MS);
  const windowEnd = windowStart + DRILL_MS;
  const active = activeCrew && at >= windowStart && at < windowEnd;

  let nextSlot = slot;
  for (let step = active ? 1 : 0; step < CREWS + 1; step++) {
    const candidate = slot + step;
    if (((candidate % CREWS) + CREWS) % CREWS === offset) {
      nextSlot = candidate;
      break;
    }
  }
  const nextAt = SCHEDULE_EPOCH_MS + nextSlot * SLOT_MS + (SLOT_MS - DRILL_MS);

  if (!active) {
    const upcoming = scenarioForSlot(nextSlot);
    return {
      scenario: "nominal",
      label: SCENARIO_LABEL.nominal,
      active: false,
      intensity: 0,
      windowStart,
      windowEnd,
      nextAt,
      nextScenario: upcoming,
    };
  }

  const p = Math.min(1, Math.max(0, (at - windowStart) / DRILL_MS));
  const fade = smoothstep(p / 0.18) * smoothstep((1 - p) / 0.18);
  const scenario = scenarioForSlot(slot);
  return {
    scenario,
    label: SCENARIO_LABEL[scenario],
    active: true,
    intensity: Math.max(0, Math.min(1, fade)),
    windowStart,
    windowEnd,
    nextAt,
    nextScenario: scenarioForSlot(nextSlot),
  };
}
