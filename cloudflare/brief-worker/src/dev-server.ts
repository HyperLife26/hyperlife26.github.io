/**
 * Local development server for the mission-brief contract.
 *
 * This is NOT the deployed Worker. It runs the same request handler with an
 * in-memory limiter and a deterministic brief, so the site can be tested
 * without a Cloudflare account:
 *
 *   PORT=8787 bun run dev:mock
 *   VITE_BRIEF_ENDPOINT=http://127.0.0.1:8787 bun run build
 */
import {
  applyWindow,
  fakeBrief,
  handleBrief,
  intFromString,
  parseOrigins,
  utcDayKey,
  type WindowState,
} from "./logic";

const windows = new Map<string, WindowState>();
const config = {
  allowedOrigins: parseOrigins(
    "https://hyperlife26.github.io,http://localhost:5173,http://127.0.0.1:5173,http://localhost:8099,http://127.0.0.1:8099",
  ),
  ipLimit: intFromString(process.env.IP_LIMIT, 8, 1, 100),
  ipWindowMs: intFromString(process.env.IP_WINDOW_SECONDS, 600, 60, 86_400) * 1000,
  dailyBudget: intFromString(process.env.DAILY_BUDGET, 300, 1, 5_000),
};

function check(key: string, limit: number, resetAt: number, now: number) {
  const { decision, next } = applyWindow(windows.get(key), limit, resetAt, now);
  windows.set(key, next);
  return decision;
}

const server = Bun.serve({
  port: intFromString(process.env.PORT, 8787, 1, 65_535),
  fetch(request) {
    return handleBrief(request, {
      config,
      checkIp: async (hash, limit, resetAt, now) => check(`ip:${hash}`, limit, resetAt, now),
      checkBudget: async (limit, resetAt, now) =>
        check(`budget:${utcDayKey(now)}`, limit, resetAt, now),
      runModel: async (facts) => fakeBrief(facts),
    });
  },
});

console.log(`HyperLife brief mock listening on ${server.url}`);
console.log(
  `limits: ${config.ipLimit} per ${config.ipWindowMs / 1000}s per IP, ${config.dailyBudget} per UTC day`,
);
