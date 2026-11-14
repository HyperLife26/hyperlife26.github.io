#!/usr/bin/env node
// Instantiates the shipped WASM in Node and checks it against the firmware
// golden vector. Run after build.sh.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const wasm = readFileSync(resolve(here, "../../public/hyperwatch/risk.wasm"));
const golden = JSON.parse(readFileSync(resolve(here, "golden.json"), "utf8"));

const module = new WebAssembly.Module(wasm);
const imports = {
  wasi_snapshot_preview1: new Proxy(
    {},
    {
      get: () => () => 0,
    },
  ),
};
const instance = new WebAssembly.Instance(module, imports);
const { hw_begin, hw_evaluate, hw_out, memory } = instance.exports;

hw_begin(72, 45, 97.5, 36.7);
const i = golden.input;
hw_evaluate(i.hr, i.hrv, i.spo2, i.temp, i.slope, i.activity, i.sleep, i.day, i.gravity, i.rad, i.age, i.cvd, i.symptom, i.cumRad);
const out = Array.from(new Float32Array(memory.buffer, hw_out(), 16));

const groups = ["fused", "model", "rule"];
let failed = 0;
for (let g = 0; g < groups.length; g++) {
  for (let k = 0; k < 5; k++) {
    const got = out[g * 5 + k];
    const want = golden.expected[groups[g]][k];
    if (Math.abs(got - want) > 0.01) {
      console.error(`FAIL ${groups[g]}[${k}] got ${got.toFixed(3)} want ${want.toFixed(3)}`);
      failed++;
    }
  }
}
if (Math.abs(out[15] - golden.expected.cardiacEvent) > 0.001) {
  console.error(`FAIL cardiacEvent got ${out[15].toFixed(5)} want ${golden.expected.cardiacEvent}`);
  failed++;
}

if (failed) process.exit(1);
console.log(`WASM parity OK (${wasm.byteLength} bytes, ${groups.join("/")} + cardiac)`);
