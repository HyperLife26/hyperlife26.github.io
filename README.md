# HyperLife

im building a health monitoring system for astronauts called HyperLife with a game/pixel-like space retro style, help me design the main pages, so the welcome page should have the registered users or an "add user" option with 'HELLO' written in pixel, if the user wants to add a new user then they will have to fill in baseline data (Crew ID, age, sex, weight, height) the choose a profile image (male astronaut, female astronaut, alien), next page they will pick their environment (moon base, mars base, spaceship) each one will have gravity and radiation under it, after the registration page is the main page, it'll look like the attached image, same style but for a pc size, top right will be the astronaut profile image with energy bar and a mission day, at the bottom (the dark area) text: finish logging your daily information to access health overview dashboard, four buttons each with a different logo (mood form, FoodDiary, general health form, dashboard), mood form questions : how are you feeling today? with 5 pixel faces to choose from [happy, neutral, sad etc], stress levels? same 5 pixel faces to answer, how many hours have you slept?, workload: bar, have you contacted your family recently?, how is your relationship with other crew members?, general health form questions: have you exercised today?, enter exercise activity in minutes, back/joints pain levels: bar, do you feel any symptoms: checklist: sore throat, fatigue, congestion, rash, FoodDiary should look the attached photo, and the dashboard as well with suggestions at the bottom, then based on the dashboard scores, the software generates a score for the members, astronauts can compare their scores in that page, fit all the parts with the same style, change the color palette like the last image

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/7ee1d98d-9102-4e13-9080-be9ad38f4fe5).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm. [Install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
bun install
bun run dev
```

The site is a static build (`bun run build`) and is hosted on GitHub Pages, so
everything runs in the browser: no server, database or wearable hardware is
required at runtime.

## Live mission dashboard

The dashboard is always available. It no longer waits for three daily logs;
instead, the log forms sharpen the model inputs.

- State is a pure function of wall-clock time:
  `snapshot(t) = f(seed, missionEpoch, schedule, profile, behaviour, logs)`.
- Crew starts are fixed, so every visitor sees the same timeline.
- `?t=<unix-ms>` opens a shareable replay. The replay re-evaluates `f(t)` for a
  seven-hour window instead of reading stored telemetry.
- Recent mood/health/food logs override the nominal crew schedule for sleep,
  training, stress, nutrition and symptoms. Without logs, a nominal schedule is
  used and the UI says so.
- Two-hour drill slots rotate through cardiac, radiation, bone and immune
  scenarios. The drill affects vitals, then flows through the same model.

Mission code lives in `src/lib/mission/`:

| File | Purpose |
| --- | --- |
| `profiles.ts` | fixed mission epochs, crew profile, mission phase |
| `scenario.ts` | deterministic drill schedule |
| `behavior.ts` | log-derived or nominal behaviour |
| `vitals.ts` | vitals generation and drill effects |
| `snapshot.ts` | `buildSnapshot` / `buildMissionView` |
| `advice.ts` | mission control suggestions |
| `brief.ts` | mission brief (browser AI, endpoint, template) |
| `hooks.ts` | mission clock and React hooks |

## On-device risk model

The dashboard runs the actual HyperWatch firmware risk engine:

- `wasm/hyperwatch/src/` vendors the C++ core from the HyperWatch repository
  (MIT, model v1.0).
- `public/hyperwatch/risk.wasm` is the compiled 13-16-8-6 int8 model plus the
  transparent rule engine. It is loaded once and used for every snapshot.
- `src/lib/mission/int8Model.ts` is an exact TypeScript mirror of the int8
  weights. It is the fallback if the WASM fetch is unavailable, so the
  dashboard always renders.
- The fused output is 55% rule engine and 45% model, matching the firmware.
  The dashboard shows the five hazard domains plus the acute cardiac flag.

`wasm/hyperwatch/golden.json` is the firmware-host golden vector. Both the
TypeScript mirror and the compiled WASM are checked against it.

Rebuild the WASM after changing the C++ core (needs Zig 0.17+):

```sh
ZIG=/path/to/zig ./wasm/hyperwatch/build.sh
node wasm/hyperwatch/verify.mjs
node wasm/hyperwatch/extract-weights.mjs
```

The generated `risk.wasm` is committed, so the normal site build does not need
a C++ toolchain. GitHub Pages cannot set COOP/COEP, so the module runs without
threads or `SharedArrayBuffer`.

The model is decision support for a research prototype, not a medical device
and not a diagnosis.

## Wearable hardware

The matching ESP32-S3 SuperMini firmware (MAX30102, TMP117, MPU6050,
SCD30/SCD40 and SH1106) is at
<https://github.com/HyperLife26/HyperWatch>. It runs the same `RiskEngine` and
int8 weights as the dashboard.

## Mission brief

The brief panel tries three sources in order:

1. `VITE_BRIEF_ENDPOINT`: the Cloudflare Worker in
   `cloudflare/brief-worker`. It receives `{ facts }` and returns `{ text }`.
   Workers AI is called through a binding, so no provider key is shipped in the
   bundle or stored in the Worker. See the [Worker README](cloudflare/brief-worker/README.md)
   for the free-plan setup, limits and deployment steps.
2. Chrome's built-in `LanguageModel` API, when the browser exposes it.
3. A facts-only template. The panel labels this `FACTS TEMPLATE` and states that
   on-device AI is unavailable.

The endpoint URL is public. Set it as the GitHub Actions repository variable
`VITE_BRIEF_ENDPOINT`; the deploy workflow passes it into the static build.
Without the variable, the site stays on the local/template paths. The brief
never invents numbers: the generated text is validated against the supplied
facts, and the template is always available as the deterministic fallback.

## Verify locally

```sh
bun run test    # deterministic timeline, drill, log override, WASM parity
bun run build   # static build + prerender of all routes
node wasm/hyperwatch/verify.mjs
(cd cloudflare/brief-worker && bun run test && bunx tsc --noEmit)
```

Deployment is the existing GitHub Pages workflow: commit, push to `main`, and
the static output is published to <https://hyperlife.health> (custom domain;
`www` redirects to the apex). The site needs no runtime environment variables;
the optional `VITE_BRIEF_ENDPOINT` repository variable only enables the
generated mission brief at build time. If the production origin changes again,
add it to `ALLOWED_ORIGINS` in `cloudflare/brief-worker/wrangler.jsonc` and
redeploy the Worker.
