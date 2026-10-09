# Use of AI in AstroDocX

NASA Space Apps 2026 allows AI-generated content when the reason is stated, the prompts are explained, and the team's own work is shown. This file is that record. Keep it current as the project changes; match its wording to the official Project Submission Guide when that publishes (13 November 2026).

## The short version
- **No AI runs inside the product.** Neither the landing page nor the Crew Console calls a language model or any other AI service. Every number, alert, explanation and action step comes from deterministic code that the team can point at and test.
- **AI helped build it.** Claude Code wrote and refactored much of the code under the team's direction. Tripo Studio generated one 3D anatomy render that we turned into the Health Twin body.
- **The decisions are ours.** Choosing the challenge, the RIDGE framing, the personal-baseline approach, what to build and what to drop, and the visual direction all came from the team. Every AI change was reviewed, run and tested before it was committed.

## Tools

| Tool | Version / model | What it was used for |
|---|---|---|
| Claude Code (Anthropic) | Claude Sonnet 5.5 and Claude Opus 5.5 | Writing, refactoring and testing code for the landing page, the Crew Console, the build scripts in `tools/`, the README and this file; checking the work in a browser preview |
| Tripo Studio | free plan, web | Generating a 3D anatomical human (skin with arteries and heart) shown as a 360° turntable video. We used only the video, not a 3D file |

Commits marked `Co-Authored-By: Claude …` in the git history were written with Claude Code (37 of the first 80 commits: 20 with Sonnet 5.5, 17 with Opus 5.5). From commit `2b79122` on, the co-author line was switched off in the tool's settings, but Claude Code is still in use. Treat any commit from then on as possibly AI-assisted.

## What the AI did not do
- **No AI in the science.** The engine in `app/src/engine/` computes the personal baselines (Welford mean and variance, EWMA smoothing), z-scores, persistence and hysteresis, the two-signal rule and the absolute limits. It is deterministic TypeScript covered by unit tests (`npm test`, 190 tests). No model computes, estimates or rewrites a number.
- **No AI in alert text.** Alert explanations ("Sleep last night 4.70 h is 3.4σ below Pilot's baseline …") are templates filled with the engine's numbers. They are not written by a model at run time.
- **No diagnosis.** The console never states a diagnosis. The evidence links under each alert give published NASA context, and they say so on screen.
- **No invented sources.** Every OSDR and NTRS reference in `app/src/engine/evidence.ts` was looked up through the public OSDR and NTRS APIs, and its title and identifier were checked against the source (October 2026). OSDR studies are cited with their DOI.
- **No invented data.** The demo mission is synthetic, and the console labels the live waves `SIM`. Only the CO₂ and radiation dose limits come from a published standard (NASA-STD-3001); other thresholds are illustrative, as the README says.

## Where AI-generated content appears in the product
1. **Health Twin body (landing page and console).** Tripo Studio rendered the anatomy turntable video. Our own script (`tools/bake-body.mjs`) reconstructs the 3D shape from the video's silhouettes. It decodes the frames, separates the figure from the background, fits the camera, and carves a voxel hull. It then fits our own procedural skeleton, arteries and organs inside the hull. The AI produced the render; the reconstruction method and the code are the team's (built with Claude Code).
2. **Code throughout the repository**, as described above.

The NASA Z2 spacesuit in the Crew scene is a NASA 3D Resources model, not AI-generated. The soundtrack is synthesised in code (`landing/universe/sound.js`), not by an AI music tool.

## Prompts
These are the main requests given to Claude Code during the 9 October 2026 session, in order, with what came out of each.

| Request (summarised) | Result |
|---|---|
| Rebuild the "Human beyond limits" scene as a particle astronaut planting a flag on the Moon, with a reference image | `tools/bake-moon.mjs`: the NASA Z2 suit with its right arm re-posed into a salute, an Apollo-style flag, lunar ground and a small Earth |
| Use the NASA Z2 Spacesuit `.glb` from NASA 3D Resources | Draco decoding (`tools/undraco.mjs`) and the shared baker library |
| Fix the Health Twin leader lines that cross the heading text | Lines routed around text in `landing/universe/health-twin.js` |
| Replace the body with a real human shape; we only have a video of a 3D model | `tools/bake-body.mjs`: visual hull from the Tripo turntable video, inner systems warped inside it |
| Use the 3D human in the console's Health Twin and crew cards | `app/src/board/body3d.ts`, WebGL particle twin, mini figures in Ground View |
| Update the README; the images are out of date | New screenshots and README text |
| Summarise the Space Apps 2026 build guide | A gap list against the guide (this file and the OSDR evidence came from it) |
| Add OSDR citations and an AI-use file | `app/src/engine/evidence.ts`, the Evidence block on each alert, this file |

**To fill in before submission (team):**
- the Tripo Studio prompt or settings used for the anatomy render
- the main requests from the earlier build sessions (7–8 October): engine, console, landing page and soundtrack
- each team member's own contributions, in the table below

## The team's own work
| Member | Role | Their work |
|---|---|---|
| Alif Mahmud | Team lead | Concept and challenge choice, visual direction (the theme comes from Alif's own portfolio template), the reference images, the NASA Z2 model and the Tripo render, reviewing and approving every change, git and deployment |
| _name_ | _role_ | _fill in_ |
| _name_ | _role_ | _fill in_ |
