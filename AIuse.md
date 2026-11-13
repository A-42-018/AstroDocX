# Use of AI in AstroDocX

NASA Space Apps Challenge 2026 allows AI-generated content when the reason is stated, the prompts are explained, and the team's own work is shown. This file is that record. It covers three things: AI that **runs inside the product**, AI that **helped build it**, and third-party AI-based components the product **uses**.

## The short version
- **AI only words, never computes.** Every number, alert, explanation, finding and action step comes from deterministic, tested code. The two guides, **NOVA** (homepage) and **VITA** (crew doctor), can re-word their answers live with Claude, and only from material the code has already checked (see below). Without an API key, or on any failure, they answer offline from the same data.
- **AI helped build it.** Claude Code (Anthropic) wrote and refactored much of the code under the team's direction. Tripo Studio generated one 3D anatomy render that became the Health Twin body.
- **The decisions are ours.** The challenge choice, the RIDGE framing, the personal-baseline approach, what to build and what to drop, and the visual direction came from the team. Every AI change was reviewed, run and tested before it was committed.
- **Prototype, not a medical device.** Nothing here diagnoses anyone.

## 1. AI that runs inside the product

| Where | What | Model | Always on? |
|---|---|---|---|
| `api/ask.py` → NOVA and VITA answers (`/api/ask`) | Re-words an answer found in the cited knowledge base (`knowledge/`) | `claude-haiku-5-5` by default (set `VITA_MODEL` to change it) | No. Needs `ANTHROPIC_API_KEY` on the server |
| `api/doctor.py` → VITA crew-doctor wording (`/api/doctor`) | Re-words the exam report the console already computed, and answers follow-up questions from it | same | No. Same key |

How it is kept honest (`api/_vita.py`, `api/_doctor.py`, with tests in `tools/vita/test/`):
- The model never sees raw readings. For the doctor it receives only the finished exam text, so it cannot add a finding.
- Its reply must be JSON that passes server-side validation. Citations the knowledge base does not contain are dropped, and a reply containing a number or a crew member that is not in the source is rejected.
- Requests are length-limited and rate-limited. If the call fails, times out or is rejected, the page falls back to the offline answer. Nothing breaks without a key.
- No API key is stored in the repository.

## 2. AI-based components the product uses (third party, not written by us)

| Component | Used for | Runs where |
|---|---|---|
| [MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe) face and hand landmarkers (Google; `.task` files in `app/public/xray/mediapipe/`) | The X-Ray Mirror finds the face and hand in the webcam picture so the 3D skull and hand bones can be drawn on top | In the browser; video never leaves the device |
| Browser speech recognition and speech synthesis (Web Speech API) | Voice navigation, and the spoken voices of NOVA, VITA and MEDI | The browser's own engine; availability depends on the browser |

## 3. Machine learning we wrote ourselves (no AI service, no outside model)
The Trends screen's **Wearable Insights** are an Isolation Forest, an additive Holt-Winters forecast, a personal ridge regression and a Bland-Altman agreement check. They are plain TypeScript with a seeded random generator: no ML runtime, no network, no pre-trained weights. They run in shadow mode and never feed the alert engine. Method, features, benchmark and limits: [`docs/ml-model-card.md`](docs/ml-model-card.md).

The webcam heart-rate pipeline (rPPG with the POS method) and the Haylou Solar 5 frame decoder are also our own code, not a model.

## 4. AI tools used to build the project

| Tool | Version / model | What it was used for |
|---|---|---|
| Claude Code (Anthropic) | Claude Sonnet 5.5 and Claude Opus 5.5 | Writing, refactoring and testing code for the landing page, the Crew Console, the 3D cabin, VITA, the build scripts in `tools/`, the README and the docs; checking work in a browser preview |
| Tripo Studio | free plan, web | Generating a 3D anatomical human (skin with arteries and heart) shown as a 360° turntable video. We used only the video, not a 3D file |

**How to spot AI-assisted commits.** Commits with a `Co-Authored-By: Claude …` line were written with Claude Code: 43 of the 247 commits on `main` as of 13 November 2026 (23 with Sonnet 5.5, 17 with Opus 5.5, 3 without a version). From commit `2b79122` on, the co-author line was switched off in the tool's settings, but Claude Code is still in use, so treat any later commit as possibly AI-assisted.

## 5. What the AI did not do
- **No AI in the science.** `app/src/engine/` computes the personal baselines (Welford mean and variance, EWMA smoothing), z-scores, persistence and hysteresis, the two-signal rule and the absolute limits. It is deterministic TypeScript. The console's suite passes 578 tests in 89 files (`cd app && npm test`).
- **No AI in alert text.** Alert explanations ("Sleep last night 4.70 h is 3.4σ below Pilot's baseline …") are templates filled with the engine's numbers.
- **No diagnosis.** The evidence links under each alert give published NASA context, and say so on screen.
- **No invented sources.** Every OSDR and NTRS reference in `app/src/engine/evidence.ts` was looked up through the public OSDR and NTRS APIs and its title and identifier checked (October 2026).
- **No invented data.** The demo mission, live vitals, cabin readings, Wi-Fi sensing and ultrasound are synthetic and labelled `SIM`. The only real astronaut measurements are the NASA OSDR Inspiration4 lab tables; see [`docs/DATASETS.md`](docs/DATASETS.md). Only the CO₂ and radiation-dose limits come from a published standard (NASA-STD-3001); other thresholds are illustrative, as the README says.
- **No AI music or audio files.** All sound is synthesised in code with the Web Audio API.

## 6. Where AI-generated content appears in the product
1. **Health Twin body (landing page and console).** Tripo Studio rendered the anatomy turntable video. Our script `tools/bake-body.mjs` reconstructs the 3D shape from the video's silhouettes (decode frames, separate figure from background, fit the camera, carve a voxel hull) and fits our own procedural skeleton, arteries and organs inside it. The AI produced the render; the method and code are the team's, built with Claude Code.
2. **Code throughout the repository**, as described in section 4.
3. **Live re-worded answers** from NOVA and VITA, only when the server has a key (section 1).

Third-party 3D assets are credited in the README and in the cabin's *Credits* button: the NASA Z2 spacesuit (NASA 3D Resources), Sketchfab models (CC BY 4.0), ambientCG surfaces (CC0), NASA Visible Earth, and the Microsoft Rocketbox doctor (MIT, [`app/public/models/doctor.LICENSE.txt`](app/public/models/doctor.LICENSE.txt)).

## 7. Prompts
The main requests given to Claude Code, with what came out of each. These are summaries of the team's real requests, not a complete log.

| Request (summarised) | Result |
|---|---|
| Rebuild the "Human beyond limits" scene as a particle astronaut planting a flag on the Moon, with a reference image | `tools/bake-moon.mjs`: the NASA Z2 suit with its right arm re-posed into a salute, an Apollo-style flag, lunar ground and a small Earth |
| Use the NASA Z2 Spacesuit `.glb` from NASA 3D Resources | Draco decoding (`tools/undraco.mjs`) and the shared baker library |
| Fix the Health Twin leader lines that cross the heading text | Lines routed around text in `landing/universe/health-twin.js` |
| Replace the body with a real human shape; we only have a video of a 3D model | `tools/bake-body.mjs`: visual hull from the Tripo turntable video, inner systems warped inside it |
| Use the 3D human in the console's Health Twin and crew cards | `app/src/board/body3d.ts`, WebGL particle twin, mini figures in Ground View |
| Add OSDR citations and an AI-use file | `app/src/engine/evidence.ts`, the Evidence block on each alert, this file |
| Build the 3D cabin, the visor HUD, the crew, robots and the EVA from the console's live engine | `app/src/cabin/` |
| Add VITA the crew doctor with an exam, three report styles and lip sync | `app/src/doctor/`, `api/doctor.py` |
| Add the webcam face scan, the X-Ray Mirror and the Haylou Solar 5 watch link | `app/src/scan/`, `app/src/xray/`, `app/src/watch/` |
| Add on-device wearable insights in shadow mode, with a model card | `app/src/ml/`, `docs/ml-model-card.md` |
| Add simulated Wi-Fi CSI sensing and guided ultrasound screens | `app/src/rf/`, `app/src/ultrasound/` |
| Add voice navigation and the one-click guided tour | `app/src/tour/`, `landing/tour.js`, voice commands in `tools/vita/` |
| Make the cabin, console and landing adapt to slower devices | Quality tiers across the cabin and landing |

## 8. The team's own work
| Member | Role | Their work |
|---|---|---|
| Alif Mahmud | Team lead | Concept and challenge choice, visual direction (the theme comes from Alif's own portfolio template), the reference images, the NASA Z2 model and the Tripo render, reviewing and approving every change, git and deployment |
| _name_ | _role_ | _to be completed by the team before submission_ |
| _name_ | _role_ | _to be completed by the team before submission_ |

The Tripo Studio settings used for the anatomy render are not recorded in the repository and are also to be added by the team.
