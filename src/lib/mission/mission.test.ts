import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { CrewMember, DayLog } from "@/lib/hyperlife/types";
import { dateKey } from "./deterministic";
import { evaluateHardwareFallback, type HardwareInput } from "./int8Model";
import { FIXED_MISSION_START } from "./profiles";
import { scenarioAt, SCHEDULE_EPOCH_MS, SLOT_MS, DRILL_MS } from "./scenario";
import { buildMissionView, buildSnapshot } from "./snapshot";

const crew: CrewMember = {
  id: "crew-orion",
  crewId: "CDR-ORION",
  age: 41,
  sex: "female",
  weightKg: 64,
  heightCm: 168,
  avatar: "female",
  environment: "mars",
  missionStart: FIXED_MISSION_START["crew-orion"]!,
};

const at = Date.UTC(2026, 10, 15, 12, 0, 0);

describe("deterministic mission timeline", () => {
  it("uses fixed mission starts", () => {
    expect(FIXED_MISSION_START["crew-orion"]).toBe("2026-07-10");
    expect(FIXED_MISSION_START["crew-vega"]).toBe("2026-09-29");
    expect(FIXED_MISSION_START["crew-kito"]).toBe("2026-04-18");
  });

  it("returns the same snapshot for the same wall-clock instant", () => {
    const a = buildSnapshot(crew, {}, at);
    const b = buildSnapshot(crew, {}, at);
    expect(a.risks).toEqual(b.risks);
    expect(a.vitals).toEqual(b.vitals);
    expect(a.behavior).toEqual(b.behavior);
    expect(a.score).toBe(b.score);
    expect(a.scenario).toEqual(b.scenario);
    expect(a.provenance).toEqual(b.provenance);
  });

  it("advances with wall-clock time", () => {
    const a = buildSnapshot(crew, {}, at);
    const b = buildSnapshot(crew, {}, at + 45 * 60_000);
    expect(a.at).not.toBe(b.at);
    expect(a.vitals.hr).not.toBe(b.vitals.hr);
  });

  it("uses a daily log to override the nominal behaviour", () => {
    const day = dateKey(at);
    const log: DayLog = {
      mood: {
        feeling: 2,
        calm: 2,
        sleepHours: 5,
        workload: 9,
        familyContact: "not-recently",
        crewRelationship: 2,
      },
      health: { exercised: false, exerciseMinutes: 0, painLevel: 7, symptoms: ["fatigue", "congestion"] },
      food: {
        meals: {
          breakfast: { name: "Oatmeal & Berries", kcal: 320, protein: 12, carbs: 54, fat: 6, fiber: 8, sugar: 14 },
        },
        waterMl: 750,
        supplements: false,
      },
    };
    const nominal = buildSnapshot(crew, {}, at);
    const logged = buildSnapshot(crew, { [day]: log }, at);
    expect(logged.provenance.behaviorSource).toBe("logs");
    expect(logged.provenance.logCompleteness).toBe(3);
    expect(logged.behavior.sleepHours).toBe(5);
    expect(logged.behavior.exerciseMinutes).toBe(0);
    expect(logged.vitals.hr).not.toBe(nominal.vitals.hr);
    expect(logged.score).not.toBe(nominal.score);
  });

  it("schedules drills deterministically and exposes the next one", () => {
    const first = scenarioAt(crew, at);
    const second = scenarioAt(crew, at);
    expect(first).toEqual(second);
    expect(first.nextAt).toBeGreaterThanOrEqual(at);
    expect(first.windowEnd).toBeGreaterThan(first.windowStart);
  });

  it("activates a drill window and feeds it into the model", () => {
    let drillAt = 0;
    for (let slot = 0; slot < 120 && !drillAt; slot++) {
      const candidate = SCHEDULE_EPOCH_MS + slot * SLOT_MS + (SLOT_MS - DRILL_MS) + DRILL_MS / 2;
      if (scenarioAt(crew, candidate).active) drillAt = candidate;
    }
    expect(drillAt).toBeGreaterThan(0);
    const drill = buildSnapshot(crew, {}, drillAt);
    expect(drill.scenario.active).toBe(true);
    expect(drill.scenario.intensity).toBeGreaterThan(0.5);
    expect(drill.scenario.scenario).not.toBe("nominal");
    expect(drill.hardware.fused.cardio + drill.hardware.fused.immune + drill.hardware.fused.bone).toBeGreaterThan(30);
  });

  it("builds a seven-hour replay from fresh evaluations", () => {
    const view = buildMissionView(crew, {}, at);
    expect(view.points).toHaveLength(42);
    expect(view.points[41]!.at).toBe(at);
    expect(view.points[0]!.at).toBe(at - 41 * 10 * 60_000);
    expect(view.vitals.hr.values).toHaveLength(42);
    expect(view.trend.cardiovascular).toHaveLength(42);
    expect(view.timeline).toHaveLength(42);
    expect(view.snapshot.score).toBe(view.points[41]!.score);
  });
});

describe("int8 model parity", () => {
  const input: HardwareInput = {
    hr: 120,
    hrv: 20,
    spo2: 92,
    temp: 38,
    slope: 0.2,
    activity: 80,
    sleep: 5,
    missionDay: 100,
    gravity: 0,
    dailyRad: 1.5,
    age: 55,
    knownCvd: true,
    symptom: true,
    cumulativeRad: 150,
  };

  it("matches the firmware golden vector in the TypeScript mirror", () => {
    const out = evaluateHardwareFallback(input);
    expect(out.fused.cardio).toBeCloseTo(90.732, 2);
    expect(out.fused.bone).toBeCloseTo(21.805, 2);
    expect(out.fused.immune).toBeCloseTo(64.91, 2);
    expect(out.fused.radiation).toBeCloseTo(29.454, 2);
    expect(out.fused.sleep).toBeCloseTo(43.467, 2);
    expect(out.cardiacEvent).toBeCloseTo(0.85022, 4);
  });

  it("ships a WASM module that matches the mirror", () => {
    const bytes = readFileSync("public/hyperwatch/risk.wasm");
    const module = new WebAssembly.Module(bytes);
    const imports = {
      wasi_snapshot_preview1: new Proxy({}, { get: () => () => 0 }),
    } as WebAssembly.Imports;
    const instance = new WebAssembly.Instance(module, imports);
    const exports = instance.exports as unknown as {
      memory: WebAssembly.Memory;
      hw_begin: (a: number, b: number, c: number, d: number) => void;
      hw_evaluate: (...args: number[]) => void;
      hw_out: () => number;
    };
    exports.hw_begin(72, 45, 97.5, 36.7);
    exports.hw_evaluate(
      input.hr,
      input.hrv,
      input.spo2,
      input.temp,
      input.slope,
      input.activity,
      input.sleep,
      input.missionDay,
      input.gravity,
      input.dailyRad,
      input.age,
      1,
      1,
      input.cumulativeRad,
    );
    const wasm = Array.from(new Float32Array(exports.memory.buffer, exports.hw_out(), 16));
    const mirror = evaluateHardwareFallback(input);
    expect(wasm[0]).toBeCloseTo(mirror.fused.cardio, 2);
    expect(wasm[1]).toBeCloseTo(mirror.fused.bone, 2);
    expect(wasm[2]).toBeCloseTo(mirror.fused.immune, 2);
    expect(wasm[3]).toBeCloseTo(mirror.fused.radiation, 2);
    expect(wasm[4]).toBeCloseTo(mirror.fused.sleep, 2);
    expect(wasm[15]).toBeCloseTo(mirror.cardiacEvent, 4);
  });
});
