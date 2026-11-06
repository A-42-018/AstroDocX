# VITA: question answering

VITA is the guide on the AstroDocX homepage. It answers questions about astronaut health, NASA research and the AstroDocX project **only from sources we picked**, with citations. It is not a medical device, never diagnoses, declines off-topic and personal medical questions, and never implies NASA endorsement.

```
browser                           Vercel (Python)                     Anthropic API or gateway
landing/vita/ask.js ── POST /api/ask ──▶ api/ask.py ── claude-haiku-5-5 ──▶
   │  (any failure, 503, timeout)           │  system prompt = knowledge/knowledge.md (cached)
   └──▶ offline matcher (faq.json)          └─ validates every URL and action before replying
```

## Files

| Path | What |
|---|---|
| `landing/vita/ask.js` | Browser client (ES module, no build). `ask(question, { history, page })` |
| `landing/vita/faq.json` | 40 offline answers with patterns, citations and actions (hand-written) |
| `api/ask.py`, `api/_vita.py` | Vercel Python function (`handler(BaseHTTPRequestHandler)`) and its logic (validation, limits, prompt) |
| `api/doctor.py`, `api/_doctor.py` | The crew doctor's live layer (below); reuses `_vita.py`'s client, parsing and limits |
| `api/requirements.txt` | Only dependency: `anthropic` (pinned) |
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

## VITA as the crew doctor (`/doctor`, `/api/doctor`)

In the console VITA is also the crew doctor. The **Crew Doctor** screen (`app/src/doctor/`) examines the whole crew, or one member (`/doctor?crew=pilot`), with rules over what the engine already computed:

| Rule | Where |
|---|---|
| One finding per open alert, with the engine's own explanation and the NASA source behind the metric | `analyze.ts` `findingsOf` |
| The same CO₂, temperature, noise or dose alert on two or more crew is **one cabin-wide finding** with whole-crew steps | `SHARED` metrics |
| Sleep or reaction trouble on two or more crew adds a **schedule change** | fatigue cluster |
| Crew in **triage order** (status, then readiness); an **EVA screen** per person (no ACT alert, no open sleep / heart / air / dose alert, readiness ≥ 70, dose under 90 % of the career limit) | `evaFor` |
| Steps from the alerts' action cards, de-duplicated, grouped **now / today / next link window**; ACT findings add "brief the flight surgeon"; a log waiting ≥ 24 h adds "send at the next window" | `adviceOf` |
| Metrics drifting the wrong way (smoothed z ≥ 1.2) with no alert yet go on a **watchlist** | `watchlistOf` |

`brief.ts` words the report in three styles (Brief, Clinical, SBAR Ground handoff); `answer.ts` answers follow-up questions offline (who first, EVA, one crew member, sleep, radiation, air, exercise, handoff) and declines personal medical questions. "Add to ground log" writes the handoff as a `note`, so it reaches the ground with the next sync.

**Live layer.** `live.ts` posts the report (words only, no raw readings) to `POST /api/doctor` (`api/doctor.py`, `api/_doctor.py`, same key, gateway, model and limits as `/api/ask`). The model may only re-word the report or answer from it. The server rejects (502, so the console answers offline) any reply that names a crew member who is not in the report or quotes a number with a unit (σ, mSv, mmHg, ms, h, min, bpm, %) that the report does not contain, and drops citations not in `knowledge/chunks.json`. After a 503/404 (no key, or the Vite dev server) the console stops asking for the rest of the visit. The findings, advice and fitness lists on the screen always come from the rules.

```
request:  { report: { scope, met, overall, headline, crew[], findings[], advice[], watchlist[], mission }, style?: 'brief'|'clinical'|'handoff', question?, history? }
response: { text, citations: [{ label, url }], source: 'live' }
```

Tests: `app/src/doctor/*.test.ts(x)` (the exam on the demo mission and a seeded CO₂ scrubber fault, styles, answers, the page) and `tools/vita/test/test_doctor_endpoint.py` (validation, invented numbers and crew rejected, request shape).

## Environment variables (Vercel)

1. Vercel dashboard → the project → **Settings → Environment Variables**.
2. Add, for **Production** (and Preview if wanted): `ANTHROPIC_API_KEY` (never prefix it `VITE_`, never put it in client code) and, when using a gateway, `ANTHROPIC_BASE_URL` (e.g. `https://api.mwapi.dev`; leave unset for api.anthropic.com).
3. Optional: `VITA_MODEL` (default `claude-haiku-5-5`), `VITA_DAILY_CAP` (default 3000 questions per day per warm instance).
4. Redeploy. Without the key `/api/ask` returns **503** and the site answers offline, so it is safe to deploy before the key exists.

The endpoint is Python because the gateway we use (mwapi) rejected the same key from Node (`fetch` and the JS SDK got `401 invalid x-api-key`) while the stock `anthropic` Python client works. The client is created with default settings (no header tricks), `max_retries=0`, and the 15 s timeout.

Local run: `set -a; source .env.local; set +a` then call `Vita().handle(...)` from `api/_vita.py` (see the tests for the shape), or `vercel dev`.

### Gateway caveats (api.mwapi.dev, checked Nov 2026)

- **Model substitution:** asking for `claude-haiku-5-5` returned responses whose `model` field says `claude-haiku-4-5`. What is served depends on the gateway's rules and can change; compare `response.model` after switching keys or gateways.
- **No schema enforcement:** `output_config.format` (json_schema) and `output_config.effort` are accepted but ignored. So VITA asks for JSON in the system prompt and parses tolerantly (bare, fenced or embedded JSON); everything is validated server-side anyway. We therefore send no `output_config` (a real API on an older model could reject it).
- **Prompt caching unverified:** `cache_control` is accepted, but the usage block shows no cache fields, so assume every request pays for the ~11k input tokens (the gateway adds some overhead too).
- Latency was 2-4.5 s per question.

## Cost and safety settings

| Setting | Value |
|---|---|
| Model | `claude-haiku-5-5` requested (the gateway may serve another, see above) |
| Prompt | Whole knowledge base (~7k tokens) in a cached system block (`cache_control: ephemeral`) |
| Output | JSON requested in the prompt and parsed/validated, `max_tokens` 1500, answers about 120 words |
| Input | Question ≤ 500 characters; history ≤ 6 turns × 1200 chars; request body ≤ 16 kB |
| Rate limit | 8 questions/min and 60/hour per IP, 3000/day overall: **in memory per warm instance**, so best effort. For a hard limit add Vercel Firewall rate limiting or Upstash |
| Timeout | 15 s to Anthropic, no retries (browser gives up after 18 s and answers offline) |
| Validation | Citations not in `knowledge/chunks.json` are dropped (labels come from our file, not the model); actions must match the allowed kinds and targets; text is stripped to plain text with `<em>` only; unusable replies become a 502 and the client answers offline |
| Refusals | `stop_reason: refusal` or `max_tokens` becomes a 502 |

A typical question is roughly 7-11k input tokens (cached when the backend supports it) + ~100 uncached + ~300 output, i.e. well under **$0.001** with a cache hit (a cache miss is about $0.001). Even the 3000/day cap is a few dollars at the very most. Set a monthly spend limit in the Anthropic console as a backstop.

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
node --test tools/vita/test/*.test.mjs                      # matcher + knowledge builder
python3 -m venv /tmp/vita-py && /tmp/vita-py/bin/pip install -r api/requirements.txt pytest
/tmp/vita-py/bin/python -m pytest tools/vita/test            # endpoint (mocked client)
```

The Node tests cover the offline matcher (40 phrasings, diagnosis and off-topic handling) and the knowledge builder (no drift, limits from `limits.ts`). `test_endpoint.py` covers response validation (bad URLs and targets dropped), the handler with a mocked Anthropic client (503 without key, 405/400/413/429/502 paths, request shape) and the client's base URL.

## Known limits

- Live answers were run locally through the Python handler against the gateway (six questions incl. off-topic and "diagnose me"). The Vercel deployment itself is untested: `api/requirements.txt` sits beside the function, so confirm the first deploy installs `anthropic` and that `knowledge/chunks.json` is bundled.
- The rate limiter is per instance. The model's `covered` flag drives "my sources don't cover that"; it is a prompt rule, not a guarantee, which is why citations are validated server-side.
