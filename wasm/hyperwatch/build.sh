#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

ZIG="${ZIG:-zig}"
OUT="../../public/hyperwatch/risk.wasm"

mkdir -p "$(dirname "$OUT")"

"$ZIG" c++ \
  -target wasm32-wasi \
  -Os \
  -fno-exceptions \
  -fno-rtti \
  -I shim \
  -I src \
  wrapper.cpp \
  src/RiskModel.cpp \
  src/RiskEngine.cpp \
  -Wl,--no-entry \
  -Wl,--export-memory \
  -Wl,--strip-all \
  -Wl,--gc-sections \
  -o "$OUT"

echo "built $OUT ($(wc -c < "$OUT") bytes)"
node verify.mjs
