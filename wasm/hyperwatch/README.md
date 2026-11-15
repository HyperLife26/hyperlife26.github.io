# HyperWatch model runtime

This directory vendors the actual HyperWatch risk engine so the browser and the
firmware run the same code.

- `src/` is copied from the public HyperWatch repository,
  `firmware/HyperWatchCore/src` at commit `04a171e` (model v1.0):
  <https://github.com/HyperLife26/HyperWatch>.
- `shim/Arduino.h` supplies the tiny platform surface the core needs.
- `wrapper.cpp` exposes a flat C ABI: `hw_begin`, `hw_evaluate`, `hw_out`.
- `build.sh` compiles `public/hyperwatch/risk.wasm` with Zig's bundled LLVM.
- `extract-weights.mjs` mirrors the int8 weights into TypeScript so the site
  still works if the WASM fetch is unavailable.

The compiled module is 13 -> 16 -> 8 -> 6 int8. The wrapper returns 16 floats:
five fused risks, five model risks, five transparent rule risks and the acute
cardiac-event probability. Scores are 0-100, the cardiac output is 0-1.

## Rebuild

```bash
./wasm/hyperwatch/build.sh
node wasm/hyperwatch/verify.mjs
```

The build needs Zig 0.17+ on `PATH` (or set `ZIG=/path/to/zig`). The generated
`public/hyperwatch/risk.wasm` is committed, so a normal site build does not need
the C++ toolchain.

## Provenance

Model: HyperWatch Risk MLP v1.0, int8 quantised, 13-16-8-6.
Runtime: HyperWatch `RiskEngine` rule engine + `RiskModel` inference.
The model is decision support for a research prototype, not a medical device.
