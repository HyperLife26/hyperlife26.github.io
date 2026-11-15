# HyperLife mission-brief Worker

A small Cloudflare Worker that turns the dashboard's facts into a 2–3 sentence
mission brief with Workers AI. The site keeps its facts-only template as the
fallback, so a missing, slow or rate-limited Worker never breaks the dashboard.

## Free plan, no billing

As of November 2026, this runs entirely on Cloudflare's free plan:

| Resource | Free allowance | This Worker |
| --- | --- | --- |
| Workers requests | 100,000 / day | one request per brief |
| Workers AI | 10,000 Neurons / day, hard cap | about 3–6 Neurons per brief |
| Durable Objects | 100,000 requests / day, 13,000 GB-s / day, 5 GB SQLite | two checks per brief |
| Credit card | not required for Workers Free | — |

The default daily budget is **300 briefs**, which is roughly **1,000–1,800
Neurons per day** at this model's published rates (4,119 per million input
tokens, 34,868 per million output tokens) — about 10–18% of the free AI
allowance. On Workers Free
the allowance is a wall: once it is used, further AI calls fail instead of
billing you. There is no overage invoice on the free plan.

The Worker uses `@cf/meta/llama-3.1-8b-instruct-fp8-fast`, which is available on
the free plan. Some large frontier models require Workers Paid; do not switch
`MODEL` to one of those without checking its model page.

## Deployed instance

The site is served at **https://hyperlife.health** (GitHub Pages custom domain)
and the brief Worker at:

```text
https://hyperlife-brief.hyperlife-brief-worker.workers.dev
```

CORS allows both `https://hyperlife.health` and
`https://www.hyperlife.health`; `www` redirects to the apex. The endpoint is set
in the GitHub Actions repository variable `VITE_BRIEF_ENDPOINT`. To redeploy
after changing this Worker:

```sh
bun run deploy
```

The endpoint and the repository variable stay the same unless the Worker name,
account subdomain or a custom route changes.

## Deploy

You need a free Cloudflare account. No API key or payment method is needed.

```sh
cd cloudflare/brief-worker
bun install
bun run test          # request validation, CORS, limits, failures
bunx tsc --noEmit     # types
bunx wrangler login   # one-time browser login
bun run deploy
```

The first deploy applies the SQLite Durable Object migration and prints a URL
like:

```text
https://hyperlife-brief.<your-subdomain>.workers.dev
```

Test it with the included facts file:

```sh
curl -sS https://hyperlife-brief.<your-subdomain>.workers.dev/ \
  -H 'origin: https://hyperlife.health' \
  -H 'content-type: application/json' \
  --data @examples/facts.json
```

Expected response:

```json
{ "text": "CDR-ORION is on mission day 128 ..." }
```

## Connect the site

The endpoint URL is not a secret. It is baked into the static build at build
time, so set it as a GitHub Actions **repository variable**:

```sh
gh variable set VITE_BRIEF_ENDPOINT \
  --body "https://hyperlife-brief.<your-subdomain>.workers.dev"
```

Then re-run the Pages workflow:

```sh
gh workflow run deploy.yml
```

The build step in `.github/workflows/deploy.yml` passes
`vars.VITE_BRIEF_ENDPOINT` to `bun run build`. Once deployed, the dashboard
brief label changes from `FACTS TEMPLATE` to `AI SERVICE`.

To use a custom domain, add a route in `wrangler.jsonc` and set the same URL as
the repository variable.

## Local development

No Cloudflare account is needed for the UI contract:

```sh
cd cloudflare/brief-worker
bun run dev:mock
```

In another terminal:

```sh
cd ../..
VITE_BRIEF_ENDPOINT=http://127.0.0.1:8787 bun run build
python3 -m http.server 8099 --bind 127.0.0.1 -d .output/public
```

The mock runs the same request handler with an in-memory limiter and a
deterministic brief. It is only for development; it is never deployed.

`bun run dev` (Wrangler) uses the real Workers AI binding, which is remote and
therefore needs `wrangler login`.

## Contract

`POST /` with:

```json
{ "facts": { "crew": "CDR-ORION", "missionDay": 128, "...": "..." } }
```

The Worker ignores any client-supplied `system` prompt. It sanitizes and clips
every fact, builds its own prompt, and validates the model output against the
same crew id and wording rules as the site.

Success:

```json
{ "text": "..." }
```

Errors are JSON `{ "error": "..." }`:

| Status | Meaning | Site behaviour |
| --- | --- | --- |
| 400 | invalid JSON or facts | template fallback |
| 403 | origin not in `ALLOWED_ORIGINS` | template fallback |
| 413 | body over 8 KB | template fallback |
| 415 | not `application/json` | template fallback |
| 429 | per-IP limit hit | template fallback |
| 502 | model unavailable or output rejected | template fallback |
| 503 | daily AI budget exhausted | template fallback |

Rate-limit responses include `Retry-After`, `X-RateLimit-Limit`,
`X-RateLimit-Remaining` and `X-RateLimit-Reset`.

## Configuration

Edit `wrangler.jsonc` and redeploy:

| Variable | Default | Purpose |
| --- | --- | --- |
| `MODEL` | `@cf/meta/llama-3.1-8b-instruct-fp8-fast` | Workers AI model; must be free-plan eligible |
| `ALLOWED_ORIGINS` | `hyperlife.health` + local origins | comma-separated CORS allowlist |
| `IP_LIMIT` | `8` | briefs per IP per window |
| `IP_WINDOW_SECONDS` | `600` | IP window length |
| `DAILY_BUDGET` | `300` | global briefs per UTC day |

## Protection

- **Per-IP limit**: the IP is hashed with SHA-256 before it is used as a
  Durable Object name. Only a counter and reset time are stored; the raw IP is
  never persisted.
- **Global daily budget**: one Durable Object per UTC day caps total AI calls,
  so even a distributed flood cannot exhaust the free allowance.
- **Origin allowlist**: blocks ordinary cross-site browser calls. CORS is not an
  authentication boundary, so the IP and budget limits are the real cost guard.
- **Input limits**: 8 KB body, known fields only, numeric ranges, clipped text.
- **Output limits**: 40–460 characters, must name the crew, and is rejected for
  diagnosis, treatment or AI-disclaimer language.
- **No provider key**: Workers AI uses the `AI` binding; there is no key in the
  Worker or the site bundle.

If the free daily AI allowance is exhausted, Cloudflare fails the AI call and
the Worker returns 502; the site falls back to its template until 00:00 UTC.

## Troubleshooting

```sh
bunx wrangler tail
```

- `403 origin_not_allowed`: add the exact site origin to `ALLOWED_ORIGINS`.
- `429 rate_limited`: wait for `Retry-After`; adjust `IP_LIMIT` if needed.
- `503 daily_budget_exhausted`: the global cap is protecting the free tier.
- `502 model_unavailable`: check `wrangler tail` and the Workers AI status page.
- Dashboard still says `FACTS TEMPLATE`: confirm the repository variable is set
  and the Pages workflow was re-run after setting it.

Deploy-time errors from Cloudflare's API:

- `10034` — the account email is not verified yet; confirm it from the
  verification mail, then deploy again.
- `10021` — `compatibility_date` is in the future. Cloudflare validates it
  against UTC, so set it to today's UTC date rather than a local date.
