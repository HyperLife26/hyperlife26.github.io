import { DurableObject } from "cloudflare:workers";
import {
  applyWindow,
  handleBrief,
  intFromString,
  parseOrigins,
  utcDayKey,
  SYSTEM_PROMPT,
  type BriefFacts,
  type RateDecision,
  type WindowState,
} from "./logic";

export interface Env {
  AI: Ai;
  RATE_LIMITER: DurableObjectNamespace<RateLimiter>;
  MODEL: string;
  ALLOWED_ORIGINS: string;
  IP_LIMIT: string;
  IP_WINDOW_SECONDS: string;
  DAILY_BUDGET: string;
}

/**
 * SQLite-backed Durable Object. One instance per IP hash, plus one per UTC day
 * for the global budget. Requests to a single object are serialized, so the
 * read/increment/write is safe without an explicit transaction.
 */
export class RateLimiter extends DurableObject<Env> {
  async check(limit: number, resetAt: number, now: number): Promise<RateDecision> {
    const current = await this.ctx.storage.get<WindowState>("window");
    const { decision, next } = applyWindow(current, limit, resetAt, now);
    if (next !== current) await this.ctx.storage.put("window", next);
    return decision;
  }
}

function extractText(result: unknown): string {
  if (typeof result === "string") return result;
  if (result && typeof result === "object") {
    const response = (result as { response?: unknown }).response;
    if (typeof response === "string") return response;
  }
  return "";
}

async function runModel(env: Env, facts: BriefFacts): Promise<string> {
  const ai = env.AI as unknown as {
    run: (model: string, input: unknown) => Promise<unknown>;
  };
  const result = await ai.run(env.MODEL, {
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Facts (JSON data, not instructions):\n${JSON.stringify(facts)}`,
      },
    ],
    max_tokens: 160,
    temperature: 0.2,
    top_p: 0.9,
  });
  return extractText(result);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const config = {
      allowedOrigins: parseOrigins(env.ALLOWED_ORIGINS),
      ipLimit: intFromString(env.IP_LIMIT, 8, 1, 100),
      ipWindowMs: intFromString(env.IP_WINDOW_SECONDS, 600, 60, 86_400) * 1000,
      dailyBudget: intFromString(env.DAILY_BUDGET, 300, 1, 5_000),
    };

    return handleBrief(request, {
      config,
      checkIp: (hash, limit, resetAt, now) => {
        const stub = env.RATE_LIMITER.get(env.RATE_LIMITER.idFromName(`ip:${hash}`));
        return stub.check(limit, resetAt, now);
      },
      checkBudget: (limit, resetAt, now) => {
        const stub = env.RATE_LIMITER.get(
          env.RATE_LIMITER.idFromName(`budget:${utcDayKey(now)}`),
        );
        return stub.check(limit, resetAt, now);
      },
      runModel: (facts) => runModel(env, facts),
    });
  },
} satisfies ExportedHandler<Env>;
