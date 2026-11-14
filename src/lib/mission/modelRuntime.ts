import {
  evaluateHardwareFallback,
  type HardwareEvaluation,
  type HardwareInput,
  type HardwareRisks,
} from "./int8Model";

type Evaluator = (input: HardwareInput) => HardwareEvaluation;

let evaluator: Evaluator = evaluateHardwareFallback;
let source: "wasm" | "fallback" = "fallback";
let loading: Promise<boolean> | null = null;

export function evaluateHardware(input: HardwareInput): HardwareEvaluation {
  return evaluator(input);
}

export function activeModelSource() {
  return source;
}

interface WasmExports {
  memory: WebAssembly.Memory;
  hw_begin: (hr: number, hrv: number, spo2: number, temp: number) => void;
  hw_evaluate: (
    hr: number,
    hrv: number,
    spo2: number,
    temp: number,
    slope: number,
    activity: number,
    sleep: number,
    day: number,
    gravity: number,
    rad: number,
    age: number,
    cvd: number,
    symptom: number,
    cumRad: number,
  ) => void;
  hw_out: () => number;
}

function fromWasm(exports: WasmExports, input: HardwareInput): HardwareEvaluation {
  const t0 = typeof performance !== "undefined" ? performance.now() : 0;
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
    input.knownCvd ? 1 : 0,
    input.symptom ? 1 : 0,
    input.cumulativeRad,
  );
  const t1 = typeof performance !== "undefined" ? performance.now() : 0;
  const values = Array.from(new Float32Array(exports.memory.buffer, exports.hw_out(), 16));
  const risks = (offset: number): HardwareRisks => ({
    cardio: values[offset]!,
    bone: values[offset + 1]!,
    immune: values[offset + 2]!,
    radiation: values[offset + 3]!,
    sleep: values[offset + 4]!,
  });
  return {
    fused: risks(0),
    model: risks(5),
    rule: risks(10),
    cardiacEvent: values[15]!,
    source: "wasm",
    version: "HyperWatch Risk MLP v1.0 (int8 13-16-8-6)",
    inferenceUs: Math.max(1, Math.round((t1 - t0) * 1000)),
  };
}

async function instantiate(url: string): Promise<WasmExports> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`model fetch failed: ${response.status}`);
  const imports = {
    wasi_snapshot_preview1: new Proxy({}, { get: () => () => 0 }),
  } as WebAssembly.Imports;
  let instance: WebAssembly.Instance;
  try {
    const result = await WebAssembly.instantiateStreaming(response.clone(), imports);
    instance = result.instance;
  } catch {
    const bytes = await response.arrayBuffer();
    const result = await WebAssembly.instantiate(bytes, imports);
    instance = result.instance;
  }
  return instance.exports as unknown as WasmExports;
}

/**
 * Loads the compiled firmware model once, then upgrades every subsequent
 * snapshot from the TypeScript mirror to the actual WASM core.
 */
export function loadWebModel(): Promise<boolean> {
  if (typeof window === "undefined" || typeof WebAssembly === "undefined") return Promise.resolve(false);
  if (source === "wasm") return Promise.resolve(true);
  if (loading) return loading;

  const base = import.meta.env.BASE_URL || "/";
  const url = `${base.replace(/\/$/, "")}/hyperwatch/risk.wasm`;

  loading = instantiate(url)
    .then((exports) => {
      exports.hw_begin(72, 45, 97.5, 36.7);
      evaluator = (input) => fromWasm(exports, input);
      source = "wasm";
      return true;
    })
    .catch(() => {
      source = "fallback";
      return false;
    })
    .finally(() => {
      loading = null;
    });

  return loading;
}
