# VITA: question answering

VITA is the guide on the AstroDocX homepage. It answers questions about astronaut health, NASA research and the AstroDocX project **only from sources we picked**, with citations. It is not a medical device, never diagnoses, declines off-topic and personal medical questions, and never implies NASA endorsement.

```
browser                           Vercel                              Anthropic
landing/vita/ask.js ── POST /api/ask ──▶ api/ask.js ── claude-haiku-5-5 ──▶
   │  (any failure, 503, timeout)           │  system prompt = knowledge/knowledge.md (cached)
   └──▶ offline matcher (faq.json)          └─ validates every URL and action before replying
```

## Files

| Path | What |
|---|---|
| `landing/vita/ask.js` | Browser client (ES module, no build). `ask(question, { history, page })` |
| `landing/vita/faq.json` | 40 offline answers with patterns, citations and actions (hand-written) |
| `api/ask.js`, `api/_vita.js` | Vercel Node function and its logic (validation, limits, prompt) |
| `api/package.json` | Only dependency: `@anthropic-ai/sdk` |
| `knowledge/chunks.json`, `knowledge/knowledge.md` | The source chunks (generated). `general.json` is the hand-written part |
| `tools/vita/build-knowledge.mjs` | Generator |
| `tools/vita/test/` | Tests |

## The contract

```js
import { ask } from '/vita/ask.js'
const { text, citations, actions, source } = await ask('Why does CO2 matter?', { history: [], page: 'home' })
// text:      plain text, may contain <em>…</em> only
// citations: [{ label, url }]            urls are always https and, when live, always from knowledge/
// actions:   [{ label, kind, target }]   kind: console | cabin | library | tour
// source:    'live' | 'offline'
```

`ask` never throws. `history` is `[{ role: 'user' | 'assistant', text }]` (the last 6 are sent). Action targets: `console` = a console route such as `/alerts` (optionally `?query`); `library` = `bone-muscle | radiation | sleep-isolation | twins-study | life-support | spacewalks`; `cabin` = empty or `eva`; `tour` = empty. Both the server and the client drop any action or citation that does not fit.

## Setting `ANTHROPIC_API_KEY` in Vercel

1. Vercel dashboard → the project → **Settings → Environment Variables**.
2. Add `ANTHROPIC_API_KEY` (value from console.anthropic.com), for **Production** (and Preview if wanted). Do **not** prefix it `VITE_` and never put it in client code.
3. Redeploy. Without the key `/api/ask` returns **503** and the site answers offline, so it is safe to deploy before the key exists.

Optional: `VITA_MODEL` (default `claude-haiku-5-5`), `VITA_DAILY_CAP` (default 3000 questions per day per warm instance).

Local run: `vercel dev` from the repo root with the key in `.env.local` (gitignored), or call the handler from Node as the tests do.

## Cost and safety settings

| Setting | Value |
|---|---|
| Model | `claude-haiku-5-5` ($0.10 in / $0.50 out per million tokens) |
| Prompt | Whole knowledge base (~7k tokens) in a cached system block (`cache_control: ephemeral`) |
| Output | Structured JSON (`output_config.format`), `effort: low`, `max_tokens` 1500 (thinking shares it), answers about 120 words |
| Input | Question ≤ 500 characters; history ≤ 6 turns × 1200 chars; request body ≤ 16 kB |
| Rate limit | 8 questions/min and 60/hour per IP, 3000/day overall: **in memory per warm instance**, so best effort. For a hard limit add Vercel Firewall rate limiting or Upstash |
| Timeout | 15 s to Anthropic, no retries (browser gives up after 18 s and answers offline) |
| Validation | Citations not in `knowledge/chunks.json` are dropped (labels come from our file, not the model); actions must match the allowed kinds and targets; text is stripped to plain text with `<em>` only; unusable replies become a 502 and the client answers offline |
| Refusals | `stop_reason: refusal` or `max_tokens` becomes a 502 (no fallback model exists for Haiku 5.5) |

A typical question is roughly 7k cached input tokens + ~100 uncached + ~300 output, i.e. well under **$0.001** with a cache hit (a cache miss is about $0.001). Even the 3000/day cap is a few dollars at the very most. Set a monthly spend limit in the Anthropic console as a backstop.

## Rebuilding the knowledge base

```bash
cd app && npm ci            # once (the generator borrows TypeScript from app/node_modules)
node tools/vita/build-knowledge.mjs          # writes knowledge/chunks.json and knowledge.md
node tools/vita/build-knowledge.mjs --check  # fails if they are out of date
```

It reads `app/src/engine/{limits,nasa,evidence}.ts`, `app/src/data/types.ts`, the README feature table and `App.tsx` routes, so the numbers (3 mmHg, 600/250 mSv, watch hours, the evidence list, the screens) follow the code. Change the engine, rerun, commit the output. The test suite fails if the committed files drift.

**Hand-written part:** `knowledge/general.json` (bone and muscle, SANS, radiation, sleep, isolation, CO₂, immune/Twins). Each fact is from a nasa.gov, NTRS or OSDR page that was opened and checked (Nov 2026). Only add a fact after reading its page.

`landing/vita/faq.json` is also hand-written; a test checks that every offline citation URL exists in the knowledge base and every action target is valid. Edit the offline answers whenever the knowledge base changes meaningfully.

## Tests

```bash
node --test tools/vita/test/*.test.mjs
```

Covers the offline matcher (40 phrasings, diagnosis and off-topic handling), response validation (bad URLs and targets dropped), the endpoint with a mocked Anthropic client (503 without key, 405/400/413/429/502 paths, request shape), and the knowledge builder (no drift, limits from `limits.ts`).

## Known limits

- Live answers have only been exercised with a mocked client unless noted in the PR/report; check a few real questions after the key is set (especially an off-topic one and a "diagnose me" one).
- The rate limiter is per instance. The model's `covered` flag drives "my sources don't cover that"; it is a prompt rule, not a guarantee, which is why citations are validated server-side.
