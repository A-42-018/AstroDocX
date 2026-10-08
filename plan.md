# AstroDocX — Astronaut Health Monitoring System
**Name:** Astronaut + Doctor + X → **AstroDocX**
NASA Space Apps Challenge 2026 · Challenge: *Create Health Monitoring Software for Astronauts on Space Missions*
Repo: https://github.com/A-42-018/AstroDocX

---

## 1. Concept
AstroDocX is an **offline-first, crew-autonomous health co-pilot**. It learns each astronaut's personal baseline and detects drift across the five spaceflight hazards (RIDGE). Every alert becomes a **clear action card** the crew can carry out without waiting for Earth.

How it works, in five steps: **detect → explain → act → log → sync later**.

| Hazard | Health effect | What AstroDocX tracks |
|---|---|---|
| **R**adiation | Immune change, cancer risk, CNS | Daily and cumulative dose, solar events |
| **I**solation & confinement | Mood, sleep, cognition | Check-in, sleep, reaction-time test |
| **D**istance from Earth | No real-time doctor | Offline action cards, delayed sync |
| **G**ravity | Bone/muscle loss, heart, vision (SANS) | Exercise load, mass, HR/HRV, BP, vision test |
| Hostile closed **E**nvironment | CO₂, infection, noise | Cabin CO₂/temp/humidity/noise, symptoms |

---

## 2. Scope Change — Today = Landing Page Sprint
**Goal today:** a professional landing page that does three things:
1. Explains our motive and solution.
2. Can be screen-recorded as the **project video**.
3. Ships with the **GitHub repo** for submission.

The health-care functionality (Crew Console) moves to **later phases** (§9).

---

## 3. Template Rules (Portfolio V32 → AstroDocX)

### ✅ Keep (do not change the logic)
- Design tokens and glass system (`styles.css` `:root`), Pulchella + JetBrains Mono fonts
- **3D astronaut** (`astronaut.js`): head tracking and flight arc
- **Shared nebula** (`script.js` L598–1024): camera segments and adaptive quality
- **ScrollTrigger pins:** About pin, Skills → Projects horizontal pin + carousel, Education timeline
- Hero warp stars, wireframe orb, typewriter, terminal, marquee, custom cursor, card tilt, reveals, counters, nav, back-to-top, reduced-motion handling

### ❌ Remove (all personal data)
- Name, bio, pitch, tagline, avatar (`avatar.jpg`), quick-info rows (university, location)
- `PROJECTS` entries + `assets/projects/*.jpg`
- Education entries, social and email links, copy-email button
- JSON-LD, canonical URL, OG/Twitter meta (rewrite for AstroDocX)
- Web3Forms `access_key` (the form is removed or gets a new team key)
- `fonts/Typeka.woff2` preload (file missing, causes a 404); keep the Special Elite fallback
- The old portfolio `plan.md`

### ⚠ Edit carefully (layout-sensitive)
| Area | Today | Needed | Risk |
|---|---|---|---|
| Skills grid | 4 cards | 5 hazard cards | Grid CSS: use 3 + 2 or 5-col on desktop |
| Education timeline | 2 nodes | 5 pipeline nodes | Node coordinates come from JS (L1380–1489): test after the change, or fall back to 3 nodes |
| Projects carousel | 8 cards | 6–7 feature cards | Data-driven, safe; the pin length recalculates |
| New section | — | Health Twin (§5) | Adds a page height change: run the nebula QA again |

**Rule:** after every content edit, scroll the full page and confirm the nebula still renders from About to Contact. This is the bug from rounds 1–3 in the template's history.

---

## 4. Landing Page Structure (story = video script)

| # | Section | Built from | Content |
|---|---|---|---|
| 0 | **Boot loader** (optional) | new, lightweight | "Initializing AstroDocX… biometric link ✓" → fades into the hero |
| 1 | **Hero** | Hero (kept) | Astronaut + "**AstroDocX**". Typewriter: *Radiation. Isolation. Distance. Gravity. Hostile.* Pitch: "Your doctor on board, when Earth is 20 minutes away." CTAs: **Watch Mission Brief** · **GitHub Repo** |
| 1b | Hero terminal | Terminal | Fake live telemetry: `HR 62 bpm ✓`, `HRV 48 ms ✓`, `CO₂ 2.4 mmHg ⚠` |
| 2 | **Marquee** | Marquee | Telemetry ticker: HR · HRV · SpO₂ · DOSE · CO₂ · SLEEP · MOOD |
| 3 | **The Problem** | About (pin kept) | Mission patch replaces the avatar. Quick-info card shows the mission profile: Mars transit, crew 4, comms delay, no ground doctor in real time. Counters show cited stats |
| 4 | **The 5 Hazards** | Skills grid | 5 glass cards (RIDGE): icon, health effect, what we track |
| 5 | **Features** | Projects carousel | 6–7 module cards with concept mockups, each labelled **Concept / v1**: Status Board · Explainable Alerts · Action Cards · Daily Check-in · Trends · Mission Simulator · Ground Sync |
| 6 | **Health Twin** ⭐ NEW | new section (§5) | Holographic body scan with callout panels, inspired by the reference images |
| 7 | **How It Works** | Education timeline | Detect → Explain → Act → Log → Sync |
| 8 | **Built On** (simple, no pin) | new static section | Tech stack chips + data sources (NASA HRP, OSDR, Twins Study, PhysioNet) |
| 9 | **Team** | Contact (scrim + glass kept) | Member cards (photo, role, GitHub/LinkedIn) + big **View on GitHub** CTA |
| 10 | **Footer** | Footer | "NASA Space Apps Challenge 2026 · Dhaka", repo link, data sources, "Concept prototype: not a medical device" |

**Nav:** Problem · Hazards · Features · Health Twin · How It Works · Team · **GitHub** (CTA)

---

## 5. Health Twin Section ⭐ (the signature visual)
Inspired by `docs/design-refs/ref-hologram-body-cyan.png` and `ref-body-panels-dashboard.png`. These images are mood references only; do not copy them.

### Visual
- A **cyan holographic human figure** in the centre, filled with a star-particle effect and a soft outer glow.
- **Glowing concentric rings** at the feet, like a scanner base, slowly rotating.
- A **scan line** sweeps head → feet; organs and bones highlight as it passes.
- **6 glass callout panels** connected to body hotspots by **thin leader lines with node dots**:

| Hotspot | Panel | Mock UI |
|---|---|---|
| Brain | Behavioral & Cognitive | Mood 4/5, reaction time 312 ms (↑ 6%), mini sparkline |
| Eyes | Vision (SANS) | Self-test status ✓ |
| Heart | Cardiovascular | Live ECG line, HR 62, HRV 48 |
| Spine / femur | Bone density | Trend bar, "–0.8% / month" |
| Thigh | Muscle & Exercise | Load bars (resistive / treadmill / cycle) |
| Blood / whole body | Radiation & Immune | Dose ring gauge, "142 / 600 mSv budget" |
| Bottom centre | **Crew Readiness** | Big ring gauge, 87%, status 🟢 NOMINAL |

### Scroll behaviour (own ScrollTrigger, pinned ~150%)
1. 0–20%: rings expand and the body fades in as a particle assemble.
2. 20–60%: the scan line sweeps down and each panel draws its leader line, then pops in when the scan passes its hotspot.
3. 60–85%: the readiness gauge counts up and the ECG starts running.
4. 85–100%: one hotspot flashes amber, and a small "Action card: Hydrate + rest 20 min" appears. This shows the explain → act idea.

### Implementation (lightweight, no third WebGL context)
- **Body:** a hand-made or CC0 SVG silhouette (license checked), sampled into a **Canvas 2D particle field** for the starry fill, plus an SVG outline with a glow filter.
- **Rings / scan line:** SVG + CSS animations.
- **Leader lines:** SVG paths drawn with `stroke-dashoffset` tied to scroll.
- **Panels:** existing glass tokens with a cyan border and JetBrains Mono numbers.
- **Mobile:** no pin; the body sits on top and the panels stack below as cards.
- **Reduced motion:** a static final state.
- **Palette tokens to add:** `--holo:#22D3EE` (cyan), `--holo-glow:rgba(34,211,238,.35)`, `--ok:#34D399`, `--watch:#F59E0B`, `--act:#F43F5E`, `--pulse:#EC4899` (ECG accent).

---

## 6. Video Plan
- Add a **Tour mode** with `?tour=1`: GSAP auto-scrolls through each section with set holds, so the screen recording is perfectly smooth (no shaky mouse wheel).
- Record with OBS at 1920×1080, 60 fps, cursor hidden, with a voice-over or music.
- **Script (follows the sections):** Hero → Problem → 5 Hazards → Features → Health Twin scan → How it works → Team + repo.
- ⚠ Confirm the **video length and format rules** on the Space Apps submission page before recording, and set the tour timings to fit.
- Optional: once uploaded, embed the video as a click-to-load YouTube modal on the hero's **Watch Mission Brief** button.

---

## 7. Repo Structure (today)
```
AstroDocX/
├── README.md              # pitch, live demo link, video link, screenshots, team, template credit
├── plan.md
├── LICENSE                # MIT
├── landing/               # static site (Netlify publish dir)
│   ├── index.html
│   ├── styles.css
│   ├── script.js
│   ├── astronaut.js
│   ├── twin.js            # Health Twin section (new, isolated)
│   ├── twin.css           # Health Twin styles (new, isolated)
│   ├── tour.js            # ?tour=1 auto-scroll (new, isolated)
│   ├── favicon.png        # AstroDocX logo
│   ├── fonts/
│   └── assets/            # mission patch, feature mockups, team photos, og-image.png
├── app/                   # Crew Console (later)
├── netlify.toml
└── docs/
    └── design-refs/       # reference images
```
- **New code goes in separate files** (`twin.js`, `tour.js`) so the tested template JS stays untouched.
- **Libraries:** keep the CDN for today (the landing page is online). Switch to bundled npm builds when the PWA console starts.
- **Deploy:** Netlify with publish directory `landing/`. Netlify Forms can replace Web3Forms if a form is needed.

---

## 8. Today's Build Sessions

| Session | Work | Output |
|---|---|---|
| **L1 — Strip & Rebrand** ✅ | Remove personal data, rewrite meta/OG, add AstroDocX logo/favicon, rewrite Hero, Marquee, Problem, Hazards (5 cards), How It Works (5 nodes), Team, Footer, nav. Fix the Typeka 404. Run nebula QA. | A working, branded landing page |
| **L2 — Health Twin** ✅ | New pinned section: particle body, rings, scan line, 6 callout panels, readiness gauge, mobile/reduced-motion fallbacks | Signature visual |
| **L3 — Features + Tour + Ship** ✅ (tour/video deferred) | 6–7 concept mockup images for the carousel, Built On section, `tour.js`, OG image, README, push to repo, Netlify deploy, final QA (1440 / 1024 / 390 px) | Live URL + repo ready + recording-ready |

The video itself is recorded after L3.

---

## 9. Crew Console — the real system (3-day build, small phases)

### 9.1 How the finished system works
**Sensors + check-ins → personal baseline → explained alert → action card → on-board log → delayed ground sync.** Fully offline (PWA + IndexedDB); Earth is optional.

1. **Inputs:** wearables/sensors (simulated) every hour: HR, HRV, SpO₂, sleep, exercise · cabin: CO₂, temperature, noise, radiation dose · daily check-in: mood, sleep quality, symptoms, reaction-time test. Each value is stored as a `Reading {crewId, metric, value, ts, source}`.
2. **Engine (per new reading):** personal 7-day baseline (Welford mean/sd) → EWMA-smoothed z-score → status Nominal / Watch (≥1.8σ) / Act (≥3σ) with hysteresis · hard absolute limits for CO₂ and dose · two-signal rules (poor sleep + slow reaction → behavioral Watch) · readiness % from all 5 RIDGE hazards.
3. **Status Board:** per-crew 5 hazard tiles, readiness ring, mission clock, link status.
4. **Explain → Act:** each alert states what changed, by how much, vs whose baseline, since when; an action card gives concrete steps; the crew ticks them and presses Done. The engine keeps watching: clears when values recover, escalates if they worsen.
5. **Log:** every alert, step, check-in and resolution goes to the on-board log, marked pending sync.
6. **Ground sync:** outbox queue that syncs in link windows; blackouts just queue; flight surgeons review afterwards (optional view).
7. **Trends:** each metric vs the personal band, alert markers, 24h / 7d / 30d, to catch slow drift.
8. **Demo mode:** simulator panel injects scenarios (solar event, CO₂ fault, insomnia, deconditioning) and fast-forwards time.

**Stack:** React + TypeScript + Vite · vite-plugin-pwa · Dexie (IndexedDB) · Zustand · Recharts · Vitest · Netlify (Supabase only as stretch). Lives in `app/`.

### 9.2 Phases (each sized for one Sonnet session window)
| # | Phase | Output | Done when |
|---|---|---|---|
| C0 | Scaffold | `app/`: Vite + React + TS, PWA plugin, router shell, theme tokens | `npm run dev` runs, app installs as PWA |
| C1 | Data model | `types.ts`, Dexie schema (crew, readings, baselines, alerts, actionLog, checkIns) | DB opens; typed read/write works |
| C2 | Synthetic data | Seeded generator: 4 crew × 30 days + 4 scenarios | Same seed → same data, loaded into Dexie |
| C3 | Engine core | Welford baseline, EWMA z, status + hysteresis (port of `sim.js`), tests | Tests pass |
| C4 | Rules + actions | Absolute limits, two-signal rule, explanation text, action-card JSON, alert lifecycle, tests | Each scenario raises the right alert |
| C5 | Status Board UI | Crew switcher, 5 tiles, readiness, mission clock | Board shows live engine output |
| C6 | Alerts + Action card | Alert list, explanation, checkable steps, Done → log | Full alert → logged action flow |
| C7 | Trends | Recharts with baseline band + alert markers, 24h/7d/30d | Charts for every metric |
| C8 | Check-in | Mood/sleep/symptoms + tap reaction test → readings | Check-in feeds the engine |
| C9 | Simulator panel | Inject scenarios, time speed-up, reset | Demo triggers every alert |
| C10 | Ground sync | Outbox, link windows, blackout, status (simulated) | Logs go pending → synced |
| C11 | Ship | Offline test, Lighthouse, Netlify deploy, landing "Launch Crew Console" CTA, README | Live URL works offline |
| C12 | Stretch | Supabase real sync and/or flight-surgeon view | Only if time is left |

**Pace:** Day 1 C0–C3 · Day 2 C4–C7 · Day 3 C8–C11. **Cut order if behind:** C12 → 30-day trend range → two-signal rule. Never cut scenarios, engine tests or offline support.

### 9.3 Phase workflow rules (every phase, no exceptions)
1. Start a session: upload the latest zip (or use the repo at `~/Developed by Alif/AstroDocX`) and say "do phase Cn from plan.md". Do only that phase.
2. No screenshot/browser QA before C11; use unit tests and `npm run build`.
3. Finish the phase: update this `plan.md` (implementation log, **Current Phase**, **Next Roadmap**) and deliver the full project as one zip.
4. **Commit and push after every completed phase:** detailed commit message(s) such as `feat(console): C3 engine core …`, author **Alif Mahmud <dev.alif8531@gmail.com>**, **no Claude co-author line**, then push to `origin main` (`A-42-018/AstroDocX`). Never force-push unless explicitly asked.
5. If the session window runs out mid-phase, continue with "continue Cn" next time.
6. Cite thresholds (NASA CO₂ limits, mission dose limits, PVT reaction test); anything uncited is labelled illustrative. Every screen says "Concept prototype, not a medical device".

---

## 10. Risks & Mitigations
| Risk | Mitigation |
|---|---|
| Nebula goes black after layout changes | Content-only edits to the pinned code; new code in separate files; full-scroll QA after each change |
| Timeline breaks with 5 nodes | Test node measurement; fall back to 3 nodes |
| Health Twin hurts performance | Canvas 2D + SVG only, particle cap, paused when off-screen |
| Hologram looks copied | Original silhouette and layout; refs are mood only |
| Judges think features already exist | Label them "Concept / v1" and state the roadmap clearly in the README |
| Video rules mismatch | Check the rules first; tour mode timings are configurable |

---

## 12. Particle Universe Intro — "From Stardust to Crew Health" (plan, not started)
Source brief: owner's *Cinematic Particle Universe* prompt (2026-10-08). The brief was cut off at "13. UI / Keep…", so §12.9 fills that part from the existing landing-page rules. Below is the brief adapted to the real repo and improved for the AstroDocX story.

### 12.1 What changes vs. the brief (and why)
| Brief | This plan | Why |
|---|---|---|
| React + R3F + Drei | **Vanilla JS + three r128 + GSAP 3.12.5** (already on the page via CDN) | The landing page is plain HTML/JS; a second three copy or a React build just for the intro adds weight and risk. The brief itself says "adapt to the repo". |
| CPU `lerp(current, target, morphProgress)` | **GPU morph, stateless:** every target shape is a vertex attribute; the vertex shader mixes shape *i* → *i+1* from one scroll value | Position is a pure function of scroll, so fast scrolling, reversing and jumping (tour mode, "Skip intro") can never leave particles in a broken state. Zero per-frame JS work for 20k+ particles. |
| All particles morph at once | **Staggered morph:** per-particle delay (by height / distance) + curl-noise "dissolve" peaking mid-transition | Shapes visibly *sweep* apart and re-form instead of a uniform blur. This is the "wow" moment. |
| Generic sci-fi spaceship / satellite | **Real NASA craft:** Orion spacecraft, TDRS relay satellite (fallback: procedural low-poly) | Fits a NASA challenge; TDRS literally relays crew data to Earth, which is our "sync later" idea. |
| Visual-only story | **Each morph is one beat of the AstroDocX pitch** (§12.2) + a heartbeat / ECG pulse on the astronaut | The intro now explains the project, not just looks good; it becomes the opening of the submission video. |
| Final CTA "EXPLORE →" | Particles form the **ASTRODOCX wordmark**; scene 07 **is the new hero**: pitch + CTAs **Launch Crew Console** / **Watch the tour** / **GitHub** | The particle astronaut replaces the old 3D astronaut, so the old hero is removed and its job moves here. |
| Bloom post-processing | **No post-processing by default**; glow is faked in the fragment shader (soft Gaussian core + halo, additive) | Bloom in r128 needs extra example scripts and a full-screen pass; the shader glow is cheaper and looks the same on points. Bloom stays an optional Q-high extra. |
| New custom cursor | **Reuse** the site's `#cursor-dot` / `#cursor-ring`, add a "VIEW"/"EXPLORE" state | Already exists and already disabled on touch. |

### 12.2 Scene script (copy = video voice-over)
Big line stays the brief's copy; the supporting line ties it to AstroDocX. Facts that need a source get one in the footer citations (plan rule 6); otherwise marked illustrative.

| # | Form (same particles) | Headline | Supporting line | Signature effect |
|---|---|---|---|---|
| 01 | Scattered dust → gathering cloud | EXPLORE / BEYOND | A new experience is taking shape. | Particles drift in from the starfield toward the centre; camera far → slow approach |
| 02 | **Mars-like planet** (soft gold-white, blue rim atmosphere) + thin orbit ring | BUILD THE FUTURE | The next crews will travel months from home. | Slow rotation, orbiting dust ring, light terminator (lit side brighter) |
| 03 | **Astronaut** floating, gold visor highlight | HUMAN / BEYOND LIMITS | Every heartbeat matters out here. | **Heartbeat:** a pulse wave ripples out from the chest every ~1 s; an ECG line made of particles draws across below the figure |
| 04 | **Orion-style spacecraft** | GO FURTHER | When Earth is up to 22 minutes away, the crew is the clinic. | Engine particles stream backward (trail), slight FOV kick + faster star parallax = acceleration |
| 05 | **TDRS relay satellite** with solar panels; small Earth far behind | CONNECT THE UNKNOWN | Health logs sync home whenever the link allows. | **Data packets:** small bright particle bursts travel satellite → distant Earth along an arc |
| 06 | **Earth** with particle continents + thin cloud shell + atmosphere halo | ONE PLANET. / INFINITE POSSIBILITIES. | Built for the crew, readable by flight surgeons on the ground. | Continents bright, oceans dim blue, slow rotation, cinematic zoom |
| 07 | Converge to a bright core sphere → **ASTRODOCX wordmark** | YOUR JOURNEY / STARTS HERE | AstroDocX — your doctor on board. | Implosion flash (brief, low intensity), then wordmark resolves; hero pitch, action typewriter and CTAs fade in (§12.8) |

### 12.3 Scroll timeline (one pinned section, `end: "+=800%"`, `scrub: 0.8`)
Each scene gets a **hold** (shape stable, text readable) and a **morph** window, so text never sits on a half-formed shape.

| Progress p | State |
|---|---|
| 0.00–0.08 | 01 hold (cloud gathering) |
| 0.08–0.16 | morph → planet |
| 0.16–0.28 | 02 hold |
| 0.28–0.36 | morph → astronaut |
| 0.36–0.48 | 03 hold (heartbeat) |
| 0.48–0.55 | morph → spacecraft |
| 0.55–0.64 | 04 hold (thrust) |
| 0.64–0.71 | morph → satellite |
| 0.71–0.80 | 05 hold (data packets) |
| 0.80–0.86 | morph → Earth |
| 0.86–0.93 | 06 hold |
| 0.93–1.00 | converge → wordmark + hero pitch/CTAs, then unpin into `#about` |

- One `master` value `p` drives everything: shader uniforms (`uSeg`, `uT`), camera, text, FX intensities. Upward scroll = exact reverse for free.
- Optional **soft snap** to hold midpoints (`snap: {snapTo: holds, duration: {min:.3,max:.8}, delay:.15}`), on by default only in tour mode.
- Timings live in one `SCENES` config array so the video length can be tuned without touching code.

### 12.4 Particle engine (one system, one draw call)
- **Geometry:** one `THREE.BufferGeometry` with `N` points. Attributes: `aP0…aP6` (vec3, 7 target shapes incl. dust cloud and wordmark), `aSeed` (vec4: random, size, colour pick, stagger), `aCol` (per-shape tint index). 9 attributes, under the WebGL1 limit of 16.
- **Vertex shader:** `i = floor(uSeg)`, `t = smoothstep(stagger, stagger+0.6, uT)`; `pos = mix(P[i], P[i+1], easeInOutCubic(t)) + curlNoise(pos, uTime) * uDissolve * sin(π·t)`; plus idle motion (per-shape rotation, breathing, heartbeat ripple `uBeat`, engine stream), mouse repel (`uMouse`, radius ~0.6 world units, desktop only). Size = `aSize * uPixelRatio * (300 / -mvPosition.z)`, clamped.
- **Fragment shader:** round soft sprite (`exp(-r²·k)` core + faint halo), depth-faded brightness, `AdditiveBlending`, `depthWrite:false`.
- **Colours:** ~70% white `#EAF2FF`, 20% cool blue `#7FA8FF`, 10% warm gold `#F5C97A`, trace cyan `#22D3EE` (site `--holo`) for ECG/data packets only. Per-shape accent: planet warmer, Earth continents blue-white, astronaut visor gold. No rainbow.
- **Correspondence:** each target array is ordered by a Morton (Z-order) sort of its normalized positions, so particle *i* lands near the "same" region in every shape → cleaner, less chaotic morphs. Option per transition: random order for a more explosive dissolve (used for 07 converge).
- **Counts (quality tiers, reuse `script.js` adaptive logic):** high 24k · mid 14k · low/mobile 8k. Targets are baked at 24k and sub-sampled (every k-th point) for lower tiers.
- **Starfield:** separate `Points`, 3 depth layers (≈3k/1.5k/600 stars), ≤35% of main brightness, twinkle via `sin(uTime*f + seed)`, parallax from camera movement. Same renderer, second draw call.

### 12.5 Shape targets (geometry → particles)
| Shape | Source | How |
|---|---|---|
| Dust cloud | procedural | random points in a thick shell + noise |
| Planet | procedural | Fibonacci sphere + crater/height noise + separate orbit-ring subset (~8% of points) |
| Astronaut | GLB (NASA 3D Resources or CC0, licence checked) → baked | area-weighted surface sampling; fallback: capsule-primitive figure |
| Spacecraft | NASA Orion GLB → baked | same; 10% of points reserved for the engine trail |
| Satellite | NASA TDRS GLB → baked | same; panels get denser sampling so they read clearly |
| Earth | NASA Blue Marble land mask (public domain) → baked | Fibonacci sphere, keep point if land (dense) or ocean (sparse, dim); +4% cloud shell |
| Wordmark | runtime | draw "ASTRODOCX" (Pulchella) to an offscreen canvas, sample lit pixels, extrude slightly in z |

- **Bake tool:** `tools/bake-particles.mjs` (Node; `@gltf-transform/core` to read meshes, own area-weighted triangle sampler, normalize to unit box, Morton sort, quantize to Int16). Output: `landing/universe/targets/<shape>.bin` (24k × 3 × 2 B = 144 KB each, ~4 files ≈ 576 KB, gzip ~ 400 KB). GLB files never ship to the browser and are never shown.
- Runtime: `fetch` the bins in parallel during the boot loader; procedural shapes are generated while waiting. Missing bin → procedural fallback, page never breaks.

### 12.6 Camera (Catmull-Rom path, no shake)
- Position and look-at each follow a `THREE.CatmullRomCurve3` with one key per scene; `p` maps to curve `u`. Smooth by construction, reversible.
- 01 far (z≈14) → slow approach · 02 gentle orbit (±18°) · 03 3/4 side angle, slightly below · 04 trailing chase, small FOV kick 50→56 · 05 orbit around the satellite with Earth in the back · 06 slow push-in on Earth · 07 dead-centre, frontal.
- Mouse adds ≤1.5° parallax (desktop). Total camera speed capped; no roll > 6°.

### 12.7 Text system
- Real DOM (`<h2>` + `<p>` per scene inside the pinned section) so screen readers and SEO get the story; the canvas is `aria-hidden`.
- Font: **Pulchella** for headlines (site brand), Inter/JetBrains Mono for supporting lines. Headlines 9–12 vw desktop, intentional line breaks as in §12.2.
- Enter: opacity 0→1, y 40→0, blur 8→0, letter-spacing 0.4em→0.12em. Exit: reverse with y −30. Driven by the same scrubbed timeline.
- Layout keeps the object clear: text left-bottom for 02/04, right for 03/05, top for 06, centre only for 01 and 07.

### 12.8 Integration with the existing page
- **New isolated folder** `landing/universe/` (template JS stays untouched, like `twin.js`):
  `universe.js` (boot, renderer, loop, tiers) · `engine.js` (geometry + material) · `shaders.js` · `targets.js` (procedural + bin loader + wordmark) · `scenes.js` (SCENES config, copy, timings) · `camera.js` · `timeline.js` (ScrollTrigger + text) · `fx.js` (heartbeat, ECG, packets, engine trail) · `universe.css` · `targets/*.bin`.
- **Placement (owner decision 2026-10-08, final):** the universe **replaces the hero**. The old `#hero` section (3D astronaut canvas, orb canvas, typewriter block) is **removed** and `astronaut.js` is no longer loaded; the particle astronaut (scene 03) takes its place. Page order: `#universe` (pinned) → `#about` → rest of the page.
- **Scene 07 = new hero:** after the wordmark forms, the hero content appears over the particle core: eyebrow `< nasa space apps 2026 />`, one-line pitch ("Your doctor on board when Earth is minutes away."), the action typewriter (Detecting drift… / Explaining… / Acting… / Syncing to Earth…), proof line ("Working PWA · offline · 4-crew demo mission inside"), CTAs **Launch Crew Console** (`/app/`) · **Watch the tour** · **GitHub**, and a "Scroll to explore ↓" hint. Hero copy follows §13.
- **Short path for returning visitors / judges:** `?skip=1`, deep links and "Skip intro" jump to p = 0.93 (scene 07, hero state) instead of past it, so the CTAs are always one click away.
- **WebGL contexts:** with `astronaut.js` gone there are two: universe + shared nebula. While `#universe` is in view the nebula (`#threeCanvas`) is paused and hidden; it fades in as the universe unpins and the universe loop stops. One small guarded hook in `script.js` (`window.ADX_NEBULA_PAUSED`); full-scroll nebula QA afterwards (known risk §10).
- **Template code that referenced `#hero`** (nav highlight, tour stops, any ScrollTrigger using hero as trigger/start) is retargeted to `#universe`; checked with a grep for `hero` in `script.js`, `tour.js`, `styles.css` before deleting.
- **Nav** hidden during scenes 01–06, appears at scene 07.
- **Render loop:** `IntersectionObserver` stops rendering when the section is off-screen and on `visibilitychange`.
- **Skip intro** link (top-right, keyboard-reachable) jumps to scene 07 (the hero state).
- **Tour mode** (`tour.js`): add the 7 hold midpoints as stops so `?tour=1` records the intro perfectly.

### 12.9 UI, accessibility, fallbacks (fills the cut-off "13. UI" part)
- Minimal chrome during the intro: logo, Skip intro, a thin progress rail with 7 ticks (scene names on hover), nav hidden until scene 07.
- Custom cursor: reuse site cursor; ring grows and shows "EXPLORE" over CTAs; off on touch (already).
- **Reduced motion:** no pin, no morphing; each scene renders as a static frame (shape fully formed) with its text, stacked as normal sections.
- **Mobile (≤900 px):** low tier, pin length 600%, no mouse repel, text bottom-aligned, camera path widened so shapes fit portrait.
- **No WebGL / context lost:** static poster image per scene (rendered from the real canvas once, `assets/universe/*.webp`).
- Contrast: text over particles gets a soft radial scrim; all CTAs ≥ 4.5:1, visible focus rings.

### 12.10 Performance budget
- 60 fps on a mid laptop iGPU at high tier, ≥45 fps on a mid Android at low tier; adaptive tier drop if the frame time stays > 22 ms for 2 s.
- New JS ≤ 35 KB gzip; bins ≤ 450 KB gzip; first scene visible < 1.5 s on 4G (procedural shapes show before bins finish).
- DPR capped at 1.75 (high) / 1.25 (low). No allocations in the render loop.

### 12.11 Owner decisions (defaults used if no answer)
1. ✅ Decided 2026-10-08 (final): universe **replaces** the hero; old hero + `astronaut.js` removed; scene 07 carries the hero pitch and CTAs.
2. Copy: AstroDocX-tied supporting lines (default, §12.2) or the brief's original lines?
3. Real NASA models for spacecraft/satellite (default) or generic sci-fi?
4. ✅ Wordmark ending (needed: it is now the hero).

### 12.12 Phases (each one session, ship + commit after each)
| Phase | Work | Done when |
|---|---|---|
| **P0 — Skeleton** *(done 2026-10-08)* | `landing/universe/` files, pinned `#universe` section, renderer + starfield, loop pause, Skip intro, SCENES config, DOM text for 7 scenes | Section pins and scrolls with placeholder text; nebula still fine |
| **P1 — Engine + procedural shapes** *(done 2026-10-08)* | Shader material, glow sprite, colour mix, GPU morph with stagger + curl noise, dust → planet → sphere → wordmark | Smooth, reversible morphs; fast-scroll / jump test passes |
| **P2 — Bake pipeline** *(tool + loader done 2026-10-08; model files pending)* | `tools/bake-particles.mjs`, licence check, astronaut + Orion + TDRS bins, Earth land-mask bake, procedural fallbacks | All 7 shapes load; missing-bin fallback works |
| **P3 — Camera + scene FX** *(done 2026-10-08)* | Catmull-Rom camera, heartbeat + ECG, engine trail + FOV kick, data packets, Earth clouds/halo, mouse repel | Each scene has its signature effect |
| **P4 — Text, cursor, scene-07 hero, old hero removal** *(done 2026-10-08)* | Text animations, layout per scene, cursor EXPLORE state, scene 07 hero (pitch, typewriter, CTAs), skip-to-07, remove `#hero` + `astronaut.js` + unused hero CSS, retarget hero references, nebula pause hook, progress rail | Story reads end-to-end; no reference to `#hero` left; nebula QA passes |
| **P5 — Fallbacks + perf + tour** *(done 2026-10-08)* | Reduced motion, mobile tier, no-WebGL posters, adaptive tier drop, tour-mode stops | 1440 / 1024 / 390 px, reduced motion, low tier all clean, no console errors |
| **P6 — Ship** | Lighthouse, OG image refresh from scene 07, README screenshots, deploy, record the video intro | Live URL checked |

### 12.13 Risks
| Risk | Mitigation |
|---|---|
| Two WebGL contexts (universe, nebula) | Nebula paused during the intro, universe stopped after it; `astronaut.js` removed |
| Judges can't find the CTAs behind a long intro | Skip intro + `?skip=1` land on scene 07 (hero state); nav CTA always visible from 07 |
| Removing `#hero` breaks template JS | Grep and retarget every `hero` reference first; full-scroll QA |
| NASA models too heavy / licence unclear | Bake offline, ship only bins; procedural fallback shapes; record licence in README credits |
| Shapes unrecognisable at low particle counts | Denser sampling on silhouettes (panels, helmet); test at 8k first |
| Long pin annoys judges | Skip intro, progress rail, soft snap, 800% max |
| Text over bright particles | Scene-specific text placement + radial scrim |

---

## 13. Landing Content Refresh — "show what the finished console does" (plan, not started)
The landing page copy was written before the Crew Console existed (concept mockups, invented panels, "console next"). The console is now complete (C0–C12, full-build pass, U0–U7), so every claim on the landing page must match the real app. Rule: **if the console doesn't do it, the landing page doesn't say it** (future ideas go in one clearly labelled Roadmap block).

### 13.1 What the console really does (source of truth for all copy)
| Area | Real feature (console) |
|---|---|
| Personal baselines | Learns each astronaut's own normal for 11 metrics (HR, HRV, SpO₂, sleep, exercise, reaction time, mood, CO₂, cabin temp, noise, radiation dose) with Welford + EWMA; only learns while nominal, so slow drift is not "learned away" |
| Detection | Smoothed z-scores + cited absolute limits (NASA-STD-3001 CO₂, mission dose), persistence (2–3 readings in a row) and two-signal rules (sleep + reaction); Nominal / Watch / Act with hysteresis |
| Explainable alerts | Each alert says what changed, by how much, against whose baseline and since when |
| Action cards | Checkable countermeasure steps, progress, Done; open → escalate → ease → resolve lifecycle, all logged |
| Status Board | Five RIDGE tiles, crew readiness score, crew overview, next action, live vitals strip (ECG-style waves, heart pulse) |
| Health Twin (console) | Anatomical hologram: live heart beating with the ECG, organs/bones take their hazard status |
| Trends | 11 charts with the personal baseline band, alert markers, 24 h / 7 d / 30 d |
| Daily Check-in | Mood, sleep quality, hours slept, 8 symptom chips, 5-tap reaction test (PVT-style); symptoms and sleep quality raise alerts |
| Mission Simulator | Mission clock, fast-forward, inject 4 scenarios (solar event, CO₂ fault, insomnia, deconditioning), watch the engine react |
| Ground Sync | Delay-tolerant outbox: link windows, 12-min delay, blackout, auto-sync, CSV log export |
| Ground View | Flight-surgeon view rebuilt only from synced entries (shows what Earth knows, and when) |
| Platform | Offline-first PWA (works with no network after first load), installable, IndexedDB on device, 4-crew 30-day demo mission preloaded |
| Quality | 165+ automated tests; Lighthouse 96 / 100 / 100 / 100 (mobile); WCAG-minded (44 px targets, reduced motion, screen-reader summaries) |

### 13.2 Section-by-section changes
| Section | Now (stale) | Change to |
|---|---|---|
| **Hero** | Separate section with 3D astronaut | **Removed.** Its content moves into particle scene 07 (§12.8): pitch, proof line "Working PWA · offline · 4-crew demo mission inside", action typewriter, CTAs Launch Crew Console / Watch the tour / GitHub |
| **Problem** (`#about`) | Good, cited | Keep. Only change the closing line to point at the working answer: "Our answer is running now →" linking to the console |
| **5 Hazards** | Lists things the console doesn't track (BP, vision self-test, shelter protocol, symptom links) | Each card lists **only real metrics + the real rule**: R dose + solar-event detection · I sleep, mood, reaction test, sleep+reaction rule · D outbox, link windows, Distance tile (Watch 24 h / Act 72 h unsynced) · G exercise load, HR, HRV · E CO₂ (NASA limit), temp, noise, symptoms. Vision/BP move to Roadmap |
| **Features carousel** | SVG concept mockups (`assets/features/*.svg`) | **Real screenshots of console v2** (Board, Alerts, Trends, Check-in, Simulator, Ground Sync, Ground View — 7 cards, + Health Twin), each with one-line "what you can do" and a deep link (`/app/board`, `/app/alerts` …). Retake screenshots at 1440 px from the deployed build; webp, lazy-loaded |
| **Health Twin** (`#twin`) | Invented panels: bone density −0.8 %/month, Amsler/vision, muscle loads, "142/600 mSv", "Concept · simulated data" | Align with the console twin: panels for the **real** systems — Brain (Isolation: mood, reaction, sleep), Heart (HR, HRV, live ECG), Lungs/air (Environment: CO₂, SpO₂), Legs (Gravity: exercise load), Whole-body aura (Radiation dose). Numbers taken from the demo mission snapshot (`demo-snapshot`), label "Demo mission data". Action card text copied from a real engine card. Readiness uses the real formula |
| **Mission Simulator** (`#sim`) | Separate landing-only mini sim (`sim.js`) with 5 scenarios incl. "comms blackout" | Keep the mini sim (it's a good teaser) but match the console's 4 scenarios + blackout from Ground Sync, use the console's wording, and add **"Run the real simulator →"** (`/app/simulator`) |
| **How It Works** | 5 steps, accurate | Keep. Add one real detail per step (e.g., Detect: "11 metrics vs your own baseline"; Sync: "12-min delay, link windows, CSV export") + a small animated packet flow |
| **Proof strip** (NEW, after How It Works) | — | Counters: 11 metrics · 5 hazards · 7 screens · 165+ tests · 100 accessibility · works offline. Each verified from the repo before publishing |
| **Built On** | "offline-first console next" | "Live" for both; real stack; detection method in one line; data sources kept. Remove "next" wording |
| **Roadmap** (NEW, small) | — | Clearly "not built yet": wearable sensor integration, real Supabase ground backend, vision/SANS self-tests, BP, bone density, multi-device ground station |
| **Team** (last section, before the footer) | 1 real + 3 placeholder cards | **6 member cards** in a 3 × 2 grid (2 columns tablet, 1 phone): photo/initials, name, role, GitHub + LinkedIn. Data lives in one `TEAM` array (`landing/team.js`) so the owner's data drops in without touching markup; placeholders until then. Repo card + event info stay below the grid |
| **Footer / meta** | — | Keep "Concept prototype, not a medical device"; update meta description + OG text to the real feature set |
| **README** | Partly concept wording | Same source-of-truth table (§13.1), real screenshots, live URL |

### 13.3 Phases
| Phase | Work | Done when |
|---|---|---|
| **R1 — Copy + data truth pass** *(done 2026-10-08)* | 6-member Team grid (placeholders, `TEAM` array), Hazards, Twin panels (from demo snapshot), Sim wording, How It Works details, Built On, Roadmap block, meta/OG, README | Every claim maps to a row in §13.1; no "concept/next/planned" left except in Roadmap |
| **R2 — Real visuals** *(done 2026-10-08)* | Screenshot console v2 (7 screens + twin, 1440 px, webp), replace feature SVGs, deep links, proof strip with verified numbers | Carousel shows the real app; links open the right screen |

### 13.4 Delivery rule for this landing sprint (owner, 2026-10-08)
- **No push** to `A-42-018/AstroDocX` until the whole landing page is finished (R1, R2, P0–P6). After each phase: update this `plan.md` and deliver the full project as one zip; the single push happens at the end (author Alif Mahmud, no Claude co-author line).

### 13.5 Owner inputs needed
- Team data for all 6 members (name, role, GitHub, LinkedIn, photo) — owner will send later; placeholders until then.
- Video URL once recorded.

---

## L1 Implementation Log (done)
- **Moved:** template → `landing/`. The original copy was removed from the repo because it contained personal data (photo, projects).
- **Removed:** all personal data (name, bio, avatar, projects, education, email, social links, resume link, JSON-LD Person, canonical URL, Web3Forms key), the Typeka preload and `@font-face` (404 fixed), and the old project images.
- **Rebranded:** title/meta/OG/Twitter tags, SoftwareApplication JSON-LD, `<astrodocX/>` logo, new `favicon.svg` + `favicon.png`, `assets/og-image.png` (rendered from the hero).
- **Sections (ids kept so the pin/nebula code is untouched):**
  - Hero: AstroDocX pitch, hazard typewriter, GitHub CTA
  - Marquee: telemetry ticker
  - `#about` → **The Problem**: SVG mission patch, mission-profile card, counters 5 / 22 min / 3 yrs
  - `#skills` → **The 5 Hazards** (RIDGE, 5 cards)
  - `#projects` → **Features** carousel (7 concept modules, SVG mockups in `assets/features/`)
  - `#education` → **How It Works** (5-node timeline)
  - `#contact` → **The Team** (4 member cards + repo card; form removed)
  - Footer: disclaimer + links
- **JS changes (minimal, outside pin/camera logic):**
  - `PROJECTS` data + `badge` ribbon
  - typewriter phrases
  - counters gained `data-suffix`
  - education timeline reads N nodes from the DOM (was hard-coded to 2)
  - Copy button copies the repo URL
- **Bug fixed (pre-existing in the template):** the nav active link drifted ("Team" lit up on Hazards). Its triggers were created before the pins existed. It is now derived from live positions, with a Hazards/Features split inside the horizontal pin and a page-bottom rule. Verified at 1440, 1024 and 390 px.
- **Added:** `README.md`, `LICENSE` (MIT), `netlify.toml` (publish `landing/`), `.gitignore`, health-status color tokens (`--holo`, `--ok`, `--watch`, `--act`, `--pulse`).
- **QA (headless Chromium, 1440×900 / 1024×768 / 390×844):** no console errors, no failed requests, no horizontal overflow. Nebula renders from About through Contact. Timeline reveals all 5 cards. Counters show the right suffixes. A brief white frame appeared in some headless captures, but it shows identically in the untouched template, so it is a software-GL capture artifact.

### Placeholders to fill (user)
- Team cards 2–4: names, roles, GitHub links (`index.html`, `#contact`; marked `TODO`)
- README: live URL + video URL
- `og:image`: change to an absolute URL after deploy (social crawlers need a full URL)
- Verify and cite the About counters (Mars signal delay ~3–22 min; ~3-year round trip) in README/footer

## L2 Implementation Log (done)
- **New files (isolated, template JS untouched):** `landing/twin.js`, `landing/twin.css`. `index.html` gained the `#twin` section (between Features and How It Works), a **Health Twin** nav link, and the two includes.
- **Figure:** original silhouette generated in code (mirrored control points → closed Catmull-Rom spline) plus a head ellipse. The same path feeds the SVG outline, the clip path and the particle sampler, so everything lines up. No third-party artwork.
- **Particles:** Canvas 2D, ~1,300 fill + ~420 edge points (≈650 + 220 on mobile), sampled with `Path2D` + `isPointInPath`. Additive blend, twinkle, brighten under the scan line. No extra WebGL context.
- **Scene:** 3 dashed base rings (CSS rotation), outline draw-on, scan line with a trail, anatomy hints lit by the scan (brain, eyes, ribs, spine, heart, abdomen, pelvis, femurs/tibias, thigh muscle), 6 pulsing hotspots.
- **Panels (6) + leader lines:** Behavioral & Cognitive (mood, reaction time, sparkline) · Radiation & Immune (dose ring 142/600 mSv) · Bone Density (trend bars, −0.8%/month) · Vision/SANS (self-test pass) · Cardiovascular (live canvas ECG, HR/HRV) · Muscle & Exercise (load bars). Leader lines are SVG paths (`pathLength=1`, dashoffset) laid out from `offset*` metrics so the entrance transforms don't shift the anchors.
- **Scroll timeline (desktop pin `+=150%`):** 0–20% rings + particle assemble · 20–60% scan sweeps, each panel draws its line and pops in as the scan passes its hotspot · 60–85% Crew Readiness counts to 87% and the ECG goes live · 85–100% heart hotspot + panel turn amber (HR 71, ↑14%, WATCH) and the "Hydrate + rest 20 min" action card appears.
- **Modes (`gsap.matchMedia`):** desktop pinned + scrubbed (frame-rate-independent easing, progress read from the pin each frame) · mobile ≤900px no pin, figure on top, panels stack as cards, sequence auto-plays once on enter · `prefers-reduced-motion` static final state, no RAF loop.
- **Performance:** RAF runs only while `#twin` is on screen (IntersectionObserver); DPR capped at 2.
- **Pin ordering:** the new pin is created after script.js's triggers, so `ScrollTrigger.sort()` + `refresh()` run after it. Verified: How It Works starts exactly one viewport after the pin ends; nebula camera segments unchanged.
- **QA (headless Chromium, 1440×900 / 1024×768 / 390×844 + reduced motion):** no console or page errors, no horizontal overflow, nav shows "Health Twin" while pinned, nebula renders through Twin → How It Works → Team.
- **Values are simulated demo data**, labelled "Concept · simulated data" in the section header.

## L2.5 Implementation Log: Live Mission Simulator (done, bonus feature)
- **New files (isolated):** `landing/sim.js`, `landing/sim.css`. `index.html` gained `#sim` (between Health Twin and How It Works), a **Live Demo** nav link and the two includes.
- **What visitors can do:** inject 5 faults (CO₂ scrubber fault, solar particle event, poor sleep night, skipped workout, comms blackout), or press **Play scenario** for a scripted run. **Reset crew** clears everything.
- **Engine (same logic planned for the Crew Console C2):** per-hazard personal baseline (mean/sd), value = baseline ± (shift + noise)·sd, EWMA-smoothed z-score, thresholds WATCH ≥ 1.8σ / ACT ≥ 3σ with 0.4 hysteresis, 1 Hz tick that runs only while the section is on screen.
- **Detect → Explain → Act → Log → Sync:** tiles with live sparklines and a baseline band → explainable alert text ("CO₂ 3.27 mmHg is 3.1σ above baseline…") → action card with checkable steps → "Carry out & log" starts recovery → entry goes to the on-board log as *pending* → ground link window (auto every 60 s, or manual; blackout takes the link down) syncs it.
- **Also live:** Crew Readiness ring (computed from all hazards), mission clock, tile selection when several alerts are active.
- **A11y/perf:** real buttons, labelled tiles, `aria-live` alert card, 44px targets, reduced-motion removes animation, no extra libraries.
- **QA:** 1440 / 1024 / 390 px: no console errors, no horizontal overflow, nav highlights "Live Demo", full inject → check steps → log → recover flow verified.

## L3 Implementation Log (done, video/tour deferred)
- **Built On section (`#built`, static, no pin):** between How It Works and Team. Stack card (landing page *Live*: HTML/CSS/JS, Three.js r128, GSAP + ScrollTrigger, Canvas 2D, SVG, Netlify · Crew Console *Planned*: React + TS, PWA, IndexedDB/Dexie, Recharts, Supabase) + 4 data-source cards linking NASA HRP, OSDR, Twins Study, PhysioNet. New `built.css`; reveal is a tiny IntersectionObserver at the end of `sim.js`. Footer gained a "Data sources" link. Not added to the top nav (already 8 items).
- **OG image:** `landing/assets/og-image.png` re-rendered at 1200×630 from the Health Twin final state (alert + action card visible).
- **README:** screenshots table (`docs/screenshots/hero.jpg`, `health-twin.jpg`, `mission-simulator.jpg`), "Try it" guide, linked data sources, updated tech + structure.
- **Final QA (headless Chromium, 1440×900 / 1024×768 / 390×844):** full-page scroll with no console/page errors and no failed local requests, no horizontal overflow, section order About → Hazards/Features → Twin → Live Demo → How It Works → Built On → Team, nav highlights every section in turn, nebula renders behind Built On and Team.
- **Deferred:** `tour.js` + video recording (user decision).
- **Nav fix:** with 8 links, "Health Twin / Live Demo / How It Works" wrapped onto two lines at ~1100–1500 px. Links are now `white-space:nowrap`, nav container widened to 1240px, tighter padding at 1101–1280px, and the hamburger menu now starts at ≤1100px (was 680px). Verified single-line links at 1920/1440/1280/1180/1101 and the dropdown at 1100/1024/768/390.

## C0 Implementation Log (done)
- **`app/`:** Vite 8 + React 19 + TypeScript, `react-router-dom` (shell with topbar nav and placeholder routes for Board, Alerts, Trends, Check-in, Simulator, Ground Sync; `/` redirects to `/board`), `vite-plugin-pwa` (autoUpdate, manifest, `navigateFallback`, service worker generated on build).
- **Theme:** `src/index.css` carries the landing palette tokens (void/indigo/violet/holo, ok/watch/act/pulse, glass card, Pulchella + JetBrains Mono stack). Every screen footer says "Concept prototype, not a medical device".
- **Icons:** `pwa-192.png` / `pwa-512.png` are upscaled from the 64px landing favicon (soft); the SVG icon is also listed. Replace with a proper 512px render later (C11).
- **Checks:** `npm run build` (tsc + vite + SW) passes, `oxlint` clean, `vite preview` serves `manifest.webmanifest` and `sw.js`. Install prompt and offline behaviour not yet tested in a browser (deferred to C11 per the QA rule).
- Package name `astrodocx-console`. `npm run dev` starts the dev server on port 5173.

## C1 Implementation Log (done)
- **`app/src/data/types.ts`:** `Hazard`, `Status`, `MetricId` (hr, hrv, spo2, sleep, exercise, reaction, mood, co2, temp, noise, dose) with a `METRICS` catalog (hazard, label, unit, bad direction), plus `CrewMember`, `Reading`, `Baseline` (Welford `n/mean/m2` + carried `ewma`), `Alert` (state open/acknowledged/resolved, explanation, action-card steps), `ActionLogEntry` (pending/synced), `CheckIn`. Timestamps are epoch ms.
- **`app/src/data/db.ts`:** Dexie `ConsoleDB` v1 with stores crew, readings (`[crewId+metric+ts]`), baselines (`[crewId+metric]`), alerts (`[crewId+state]`), actionLog (`sync`), checkIns. Helpers: `addReading`, `readingsFor` (range query), `openAlerts`, `pendingSync`, `resetDb`. The class takes a DB name so tests use an isolated instance.
- **Tests (Vitest + fake-indexeddb, `npm test`):** 5 pass (open with 6 stores, typed reading round-trip and range query, baseline upsert, open-alert filter, pending-log and check-in persistence). `npm run build` and `oxlint` clean.
- Deps added: `dexie`, `zustand` (used from C5), dev `vitest`, `fake-indexeddb`.
- Metric baselines and units are illustrative; thresholds get citations in C4.

## C2 Implementation Log (done)
- **`app/src/data/synthetic.ts`:** seeded generator (mulberry32 + Box-Muller). `generateReadings({seed, days, scenarios, crew, start})` is pure and deterministic; mission start is fixed (`MISSION_START` = 2030-01-01Z) so output never depends on the wall clock. `seedDb()` clears the DB and loads crew + readings (idempotent).
- **Data shape:** 4 crew (Commander, Pilot, Flight Engineer, Medical Officer) x 30 days. Hourly: hr, hrv, spo2, co2, temp, noise, dose. Daily at 07:00: sleep, exercise, reaction, mood. Total `4 x 30 x (7x24+4)` = 20,640 readings. Each crew member has a personal offset (up to ~0.8 sd) per metric, so baselines differ per person.
- **Scenarios (opt-in, `SCENARIOS`):** `solar` (all crew, day 20, dose +8σ) · `co2` (all, day 24, CO2 +6σ, HR +1σ) · `insomnia` (pilot, days 26-29, sleep -4σ, reaction +3σ, mood -3σ) · `deconditioning` (flight engineer, days 22-29, exercise -5σ, HRV -2.5σ, HR +2σ). Shifts are sized to cross the 3σ Act threshold in C3/C4. Default history has none, so the engine can be tested on a clean baseline.
- **Tests (9 new, 14 total, all pass):** same seed identical / different seed differs, counts and time bounds, value validity (mood 1-5, SpO2 <= 100), per-crew personalization, each scenario shifts only its metrics, crew and window, `seedDb` loads Dexie and re-seeding keeps counts. `npm run build` and `oxlint` clean.
- Normal means/sds are illustrative; citations come with the C4 thresholds.

## C3 Implementation Log (done)
- **`app/src/engine/baseline.ts` (pure):** `welfordUpdate` (cumulative Welford up to a window cap, then exponentially weighted mean/variance so the baseline follows slow healthy change), `sdOf` (with a floor of 2% of the mean), `rawZ` (signed by the metric's bad direction, absolute value for two-sided metrics such as HR and temperature), `ewma` (alpha 0.5), `classify` (WATCH >= 1.8σ, ACT >= 3.0σ, 0.4σ hysteresis on the way down; same constants as `landing/sim.js`) and `step`, which processes one reading.
- **Behaviour of `step`:** nominal and unscored during warm-up (48 samples for hourly metrics, 14 for daily); afterwards the value is scored against the baseline *before* it is learned, and it is only learned while the smoothed status is nominal, so a developing problem cannot drag the baseline toward itself. Windows: 168 samples hourly (7 days), 21 daily.
- **`app/src/engine/replay.ts`:** `replay(readings)` runs a stream in memory (for tests and the simulator later), `ingest(reading, db)` scores one new reading and persists it with the updated baseline in one transaction.
- **Data model change:** `Baseline` gained `status` (needed for hysteresis between readings); no Dexie schema change, it is not indexed.
- **Tests (17 new, 31 total, all pass):** Welford equals batch mean/sd, window cap tracks a level shift, z sign per bad direction, thresholds, hysteresis both ways, warm-up, baseline freeze during an alert, recovery, `ingest` persistence, and the scenarios replayed: solar, CO2, insomnia and deconditioning each reach ACT on their key metric inside their window; solar and CO2 return to nominal afterwards. `npm run build` and `oxlint` clean.
- **Tuning found by the tests:** learning only readings below 1.8σ truncated the sd and gave false Acts, so learning now depends on the smoothed status; a 7-sample daily warm-up was too noisy, so it is 14.
- **Known limit:** on clean data over 30 seeds, 28 give no false Act and 2 give one Act in 20,640 readings; Watch is about 0.8% of scored readings. The fixed-seed tests use seeds 42 and 99. C4 adds a persistence rule for Act (and absolute limits) to cut this further.

## C4 Implementation Log (done)
- **Absolute limits (`app/src/engine/limits.ts`), cited:** CO2 average 1-hour habitat ppCO2 <= 3 mmHg (NASA-STD-3001 Vol. 2, [V2 6004]); career effective dose 600 mSv and 250 mSv per solar particle event (NASA-STD-3001 Vol. 1). Source URLs are in the file header. CO2 rule: Watch after 3 consecutive hourly readings above 3.0 mmHg, Act after 6, or at once at 4.5 mmHg (**illustrative** emergency level). Dose rule: rolling 24 h dose versus 250 mSv (Watch at half, Act at the limit); the career 600 mSv budget is shown in every dose alert from a running total. Everything else (steps, persistence counts, 4.5 mmHg) is labelled illustrative.
- **Persistence (new, from C3's false-alert finding):** a statistical Watch needs N consecutive readings and Act needs N consecutive Act readings (N = 3 hourly, 2 daily). Clean-history check: seeds 42 and 99, two crew each, give no Act and 6 Watch alerts (about 3 per crew-month); the earlier 22 and 20 were single-blip Watches.
- **Two-signal rule:** sleep and reaction both off baseline for one crew member raises a behavioral Watch (`ruleId 'sleep+reaction'`, kind `combined`, hazard I) with its own explanation and steps.
- **Explanations and action cards (`actions.ts`):** "what changed, by how much, against whose baseline, since when" (`Reaction time 361 ms is 3.2σ above Pilot's baseline (...). Started at D26 07:00 MET.`) and illustrative 3-4 step cards per metric and level (co2, dose, sleep, reaction, exercise, hr, hrv, spo2, generic fallback, behavioral).
- **Alert lifecycle (`pipeline.ts`):** `processReading(reading, db)` scores, applies limits and persistence, then one alert per crew + ruleId: opens, updates, escalates (reopens the card with fresh steps), eases, and resolves when values recover, writing each change to the on-board log as `pending`. `setStepDone` and `completeActionCard` (Done -> `acknowledged`) are the crew actions; the engine still resolves the alert on recovery. `processAll` loads a batch in time order.
- **Data model additions:** `Alert.ruleId`, `kind`, `peakStatus` (highest level reached, since an alert can ease to Watch before resolving); `Baseline.warnRun`, `actRun`, `limitRun`, `total` (running sum, used for cumulative dose). No Dexie schema change (none are indexed).
- **Synthetic data change:** cabin metrics (CO2, temperature, noise, dose) now carry no personal offset, because they describe the shared habitat; otherwise the 3.0 mmHg limit fired on a crew member's normal baseline.
- **Tests (46 total, 32 new, ~40 s because every reading is a fake-indexeddb transaction):** limits and citations, action cards for every level, MET format, lifecycle (open -> escalate -> resolve, Done and reopen, cumulative dose, event-dose limit alert), each scenario raises the right alert (solar and CO2 reach Act for every crew member checked and resolve; insomnia gives the pilot a sleep alert plus the combined Watch; deconditioning gives the flight engineer an exercise Act; bystanders stay quiet), and clean history stays free of Act. Scenario runs use two crew members each to keep runtime reasonable. `npm run build` and `oxlint` clean.

## C5 Implementation Log (done)
- **Demo data (`app/src/data/demo.ts`):** on first run the app seeds a 30-day mission (seed 42, insomnia for the pilot and deconditioning for the flight engineer still active at the end) through the full engine, then marks log entries older than 24 h as synced so the ground-link tile has something real to show. `seedDemo()` replaces the DB; it shows progress in the UI.
- **Faster ingest:** `processAll` now wraps the batch in one IndexedDB transaction (nested `processReading` joins it): 20,640 readings in about 7 s instead of minutes. The scenario tests in `pipeline.test.ts` still use two crew members each and could now use all four.
- **Selectors (`app/src/board/snapshot.ts`, pure and tested):** `loadSnapshot(crewId)` reads baselines, open alerts, latest headline readings and the log for one crew member; `buildTiles` makes the five RIDGE tiles. Tile status is the worst open alert for that hazard; headline metrics are dose rate (R), sleep (I), exercise (G), CO2 (E). **Distance (D)** has no sensor, so it shows time since the last ground sync and pending entries, and goes Watch at 24 h / Act at 72 h of the oldest unsynced entry (illustrative; C10 makes the sync real).
- **Readiness (illustrative formula):** per hazard, 100 minus up to 40 points for the worst smoothed z (3σ = full penalty), capped at 80 for Watch and 55 for Act so an active alert always lowers it; readiness is the mean of the five. Overall status is the worst tile.
- **UI:** `board/StatusBoard.tsx` (crew tabs, readiness ring, five tiles with status icon + text, explanation or "what we track", mission clock `D29 23:00 MET`, last-sync line), `BoardPage` (loading / error / empty states), Zustand store for the selected crew and boot state, `useSnapshot` via Dexie `liveQuery` (updates when the DB changes), `useBootDemo`. Status is shown by icon and text as well as color; tabs are 44 px; reduced-motion removes the ring transition. Other routes are still placeholders.
- **Tests (60 total, 14 new, ~20 s):** scoring and link-status rules; the demo snapshot (five tiles per crew member, mission clock at D29 23:00, pilot's insomnia on Isolation with an explanation, engineer's Gravity at Act, commander all nominal with the highest readiness, ground link nominal with pending entries); unknown id falls back, empty DB returns null; StatusBoard component render and tab switching (jsdom + Testing Library); an App-level test that boots and seeds the demo, shows the Commander's board and switches to the Flight Engineer. `npm run build` and `oxlint` clean. **No browser/screenshot QA yet, per the plan (C11).**
- Deps added (dev): `jsdom`, `@testing-library/react`.

## C6 Implementation Log (done)
- **Alerts page (`app/src/alerts`):** `AlertsPage` (live data via `useSnapshot` + a `liveQuery` of resolved alerts, `resolved.ts`) feeds the pure `AlertsView`: crew tabs (shared `board/CrewTabs`), active alerts most urgent first, "Recently resolved" list (last 8 with peak level and MET span).
- **Action card (`AlertCard`):** title, status icon + text, opened-at MET (and "peaked at ACT" when eased), the engine's explanation, a fieldset of checkable steps (44 px targets, strike-through when done), "n of m steps done", and **Done**. Steps call `setStepDone`, Done calls `completeActionCard`; both log as `pending` with mission time (`snap.now`) so the log stays in step with readings. An acknowledged card locks its steps and button, but the engine still resolves the alert on recovery.
- App routes `/alerts` to the real page; the other placeholders remain.
- **Tests (64 total, 4 new files' worth: 3 view tests + 1 integration, ~33 s):** view renders explanation/progress, reports ticks and Done, locks acknowledged cards, lists resolved, empty state; integration boots the demo, opens Flight Engineer alerts, ticks a step and presses Done, then checks the DB log (`step-done`, `pending`) and the alert state `acknowledged`. `tsc`, `oxlint` and `npm run build` clean. No browser QA until C11.

## C7 Implementation Log (done)
- **Trends page (`app/src/trends`, route `/trends`):** crew tabs, range buttons (24 h / 7 days / 30 days, default 7 days), and one Recharts card per metric (11: dose, sleep, reaction, mood, exercise, HR, HRV, CO2, SpO2, temperature, noise). Each card shows the line, the personal band, alert dots (amber Watch, red Act, using the alert's peak level) and a text summary ("latest value, inside/outside personal band, n alerts in range") that doubles as the chart's `aria-label`. CO2 also draws the cited NASA 3.0 mmHg limit line.
- **Band (`series.ts`, pure and tested):** rebuilt with the engine's own Welford/EWMA baseline (same per-metric window), baseline mean ± 1.8σ (the Watch threshold), from samples *before* each point so a spike never widens its own band; no band for the first 8 samples. History before the visible range still feeds the band. The two-signal alert shows on both the sleep and reaction charts.
- **Data (`data.ts`):** `loadTrendData` reads a crew member's full history and alerts through `liveQuery` (about 5k readings, fast); charts update when the DB changes.
- Dep added: `recharts`. Precache grew to about 740 KiB.
- **Tests (73 total, 9 new, ~42 s):** series (range filter, band warm-up and shape, no self-widening, pre-range history, marker placement and range filter, empty series, two-signal routing), view (text summaries, range/crew callbacks), and a demo integration (11 charts render, pilot's 30-day sleep series has points, band and an alert marker). jsdom cannot lay out SVG, so chart pixels are not asserted; **visual check is left to C11 browser QA**. `tsc`, `oxlint`, `npm run build` clean.

## C8 Implementation Log (done)
- **Check-in page (`app/src/checkin`, route `/checkin`):** crew tabs, mood 1-5 and sleep quality 1-5 (radio rows, 44 px targets), optional hours slept (blank keeps the wearable value, so a day is not double counted), eight symptom chips, the reaction test, and Save. Saving shows a confirmation that lists any alert the check-in raised (pointing to the Alerts tab) or cleared, then resets the form.
- **Reaction test (`pvt.ts`, `ReactionTest.tsx`):** 5 taps, random 1.5-5 s wait, pad turns green; early taps and responses under 100 ms are false starts; result is the median of valid taps (needs 3), plus lapses (> 500 ms). Modelled on the PVT-B used on the ISS (Basner, Mollicone and Dinges 2011, Acta Astronautica 69:949-959); the 5-trial length, wait range and 100 ms floor are **illustrative**.
- **Save path (`submit.ts`):** one transaction writes the `CheckIn`, sends `mood` (always), `sleep` (if hours given) and `reaction` (if the test was taken) through `processReading` with source `checkin`, and adds one pending `checkin` entry to the on-board log. Timestamp is mission "now" (latest reading). So alerts, the two-signal rule, the board and trends all react. Input is validated (1-5 scales, 0-16 h) and nothing is written on failure.
- **Known limits:** sleep quality and symptoms are stored and logged but have no metric, so they do not trigger alerts yet (stated on the form). Several check-ins at the same mission time are allowed.
- **Tests (86 total, 13 new):** PVT summary (median, even count, false starts, too few valid taps); the reaction pad with fake timers (five taps give median and lapse; early taps give no result); form (blocks until required answers, submits exact payload and resets, shows a raised alert); `submitCheckIn` on a 20-day DB (check-in row, three `checkin` readings, pending log text, repeated 900 ms reactions raise a reaction alert, invalid input writes nothing). `tsc`, `oxlint`, `npm run build` clean. No browser QA until C11 (the tap timing feel in particular).

## C9 Implementation Log (done)
- **Simulator page (`app/src/sim`, route `/simulator`):** four scenario cards (solar event, CO2 fault, insomnia, deconditioning) with a "Who" picker (default crew from `SCENARIOS`, or one person, or whole crew) and Inject; a "Running now" list with End now; time controls +1 h / +6 h / +1 day / +3 days; a "Last run" summary (readings processed, NEW and CLEARED alerts by person and level); and Reset to the demo mission behind a two-step confirm (it erases local data).
- **Time and data (`advance.ts`):** the mission clock is the latest reading. `advance(hours, injections)` generates the next hours (hourly metrics every hour, daily metrics at 07:00 MET) centred on each person's healthy level (median of the first 14 mission days, before any scenario), adds the active scenarios' shifts (sd units, same table as the history generator), and runs everything through `processAll`, so alerts, persistence, logging and the board behave exactly as for real readings. Seeded by the start time, so the same state gives the same data.
- **Inject** adds the scenario (lasting its `SCENARIOS` duration) and immediately runs a lead time so the effect shows (6 h for solar and CO2, 48 h for insomnia and deconditioning, because daily metrics need two daily readings). Running injections are in memory (Zustand): a reload ends them, the readings stay. Advancing time ages unsynced log entries, so the Distance tile goes Watch after 24 h, which C10 resolves with real sync.
- **Tests (99 total, 13 new):** window generation (deterministic, daily metrics only at 07:00, shifts hit only the injected person), every scenario raises the right alert for the right person (solar -> dose, resolves after it ends; CO2 -> Act for both; insomnia -> sleep alert, no bystander; deconditioning -> exercise), no alerts when nothing is injected, view callbacks and reset confirm, and an App-level run on the demo mission (inject solar, clock moves to D30 05:00, Dose rate ACT reported). Vitest now caps workers at 3 and the demo-seeding tests have longer timeouts, because four files seed the 20k-reading demo and starved each other. `tsc`, `oxlint`, `npm run build` clean. No browser QA until C11.

## C10 Implementation Log (done)
- **Ground Sync page (`app/src/sync`, route `/sync`):** link status with icon and text (LINK OPEN / WAITING FOR WINDOW / BLACKOUT), time to the next window or to closing, queued count, last sync, one-way delay; an **outbox** of pending log entries and a "Recently synced" list showing when each was sent; **Sync now** (enabled only in an open window with something queued), "Simulate comms blackout" and "Auto-sync in windows" toggles.
- **Simulated link (`link.ts`, pure):** two 2-hour windows per mission day (00:00 and 12:00 MET) and a one-way delay of 12 min. All three are **illustrative**, not a real contact plan (a Mars one-way light time is roughly 3 to 22 min). A blackout overrides any window.
- **Outbox (`outbox.ts`):** `syncNow` marks all pending entries `synced` with `syncedAt` (throws in blackout or between windows, entries stay queued); `autoSync(from, to)` runs after each simulator advance and, for every window passed, uploads what was queued up to 30 min after it opened (nothing during a blackout), so the sync time and history look realistic. Entries are mission-wide, not per crew.
- **Wiring:** the Simulator calls `autoSync`, so fast-forwarding past midnight/noon clears the queue and resets the board's Distance tile (Watch at 24 h and Act at 72 h unsynced); a blackout lets it climb to those levels. All six nav routes are real pages; the placeholder component is gone.
- **Tests (112 total, 13 new):** window schedule and open/closed/blackout; `syncNow` and `autoSync` (30 min upload lag, blackout, no window crossed, later entries stay queued); view states (open, closed, blackout, empty); an App-level run on the demo (closed at 23:00 with the next window in 1.0 h, +6 h in the simulator clears the older queue and fills "Recently synced"). `tsc`, `oxlint`, `npm run build` clean. No browser QA until C11.

## C11 Implementation Log (done except the live deploy)
- **Single-site layout:** the console is built with base `/app/` (router basename from `BASE_URL`, PWA scope and start_url `/app/`, service-worker fallback `/app/index.html`). `netlify.toml` builds it (`cd app && npm ci && npm run build`), copies `dist` to `landing/app/` (git-ignored) and publishes `landing/`, with a `/app/*` SPA redirect and no-cache for `sw.js`. So one Netlify site serves the landing page at `/` and the console at `/app/`.
- **Landing page:** hero primary button and nav CTA are now "Launch Crew Console" (`/app/`); the Built On card marks Crew Console **Live** and lists the real stack. README rewritten (status, run, deploy, tech, structure).
- **Browser QA (built-in browser at 375 px and desktop, on a fresh DB):** all six screens render with no horizontal overflow at 375 px; 11 charts draw; a real check-in with five reaction taps saved (median 323 ms); a CO2 injection raised Act for all four crew and the board showed "Last ground sync 4.5 h ago" and "6 pending". Bugs found and fixed:
  1. **"Started at" drifted:** an ongoing alert's explanation was rewritten with the latest reading's time (card said opened D27, text said started D29). `alertSince` now keeps the alert's original start. Regression test added.
  2. **Distance tile used per-crew sync data** ("114 h since sync, 0 pending" for the Commander). The ground link is shared, so the board now reads the whole log; the demo seed replays the C10 link windows, so the starting state is "synced 10.5 h ago, a few entries queued".
  3. **Half-seeded DB after a reload during first-run seeding** (crew existed, readings did not, and the app treated it as loaded). `seedDemo` now runs in one transaction, so an interrupted seed keeps nothing.
  4. **Top nav overflowed at phone width** (fixed-height bar, links overlapped the crew tabs); it now wraps with 44 px targets.
  5. Contrast (Lighthouse): active-nav and chip backgrounds softened (`--holo-soft`), footer text lightened.
- **Offline (headless Chrome via puppeteer-core, production build):** service worker registers and controls the page; with the network switched off, reload of the board and loads of Alerts, Trends, Check-in, Simulator and Sync all render from the precache plus IndexedDB, with no console errors. (The in-app browser pane blocks service-worker scripts, so this check used Chrome.)
- **Lighthouse (headless Chrome, mobile profile, `/app/board`, first load includes seeding the 20k-reading demo):** performance 96, accessibility 100, best practices 100, SEO 100. The remaining notes are main-thread time from seeding and unused JS (Recharts); not addressed.
- **Tests: 113.** `tsc`, `oxlint`, `npm run build` clean.
- **Not done:** the Netlify deploy itself (needs the owner's Netlify account), so README and `og:image` still say "add URL"; an iOS or Android install check; keyboard-only and screen-reader pass.

## C12 Implementation Log (stretch, done: flight-surgeon view; Supabase not done)
- **Ground View page (`app/src/ground`, route `/ground`):** the Earth-side picture of the crew, rebuilt **only from synced log entries** (`derive.ts`): per person the open alerts (level parsed from the log text, opened time, steps reported done), recently resolved alerts, the last check-in received, and a count of entries "on board, not yet downlinked" (Earth sees the count, never the content). A header shows "data current to <last sync>", how many entries are still on board, and states that the crew's console is always ahead. Received time adds the illustrative 12 min one-way delay.
- **Why this and not Supabase:** it demonstrates the delay-tolerant idea (detect on board, Earth catches up after a window) without needing an account or a network service, and it works offline. A real backend (Supabase, with row-level security and signed-in surgeons) is still a possible follow-up and would be the first piece that needs the owner's credentials.
- **Tests (120 total, 7 new):** level parsing, alert rebuild from open to escalate to step to resolve, pending entries invisible but counted, Act before Watch, check-in tracking, delay; component render; demo mission (Earth knows the pilot's sleep alert and the engineer's exercise alert, the Commander is clear, some entries are still awaiting downlink). Checked visually in the built-in browser. `tsc`, `oxlint`, `npm run build` clean.
- **Known limits:** the ground view is in the same browser/DB as the crew console (a simulation of the Earth side, not a second device); alert level is parsed from log text, so a real backend should send structured fields.

## Landing citations (done)
- The About counters now carry a "Sources" line (`.about-sources`, `landing/built.css`): 5 hazards (NASA HRP, https://www.nasa.gov/hrp/), distance from Earth (https://www.nasa.gov/hrp/hazard-distance-from-earth/), and Mars communication delay of up to 22 min one way on an 850-day mission (NASA NTRS 20220013418, https://ntrs.nasa.gov/citations/20220013418). The "about 3 years" round trip is marked approximate (NASA HRP describes roughly three years away from Earth). Checked in the browser at the pinned About step.

## Video tour mode (done, recording is yours)
- `landing/tour.js`, loaded last on the landing page, does nothing unless the URL has `?tour=1`. It then waits (`&delay`, default 3 s), scrolls hero to footer with a trapezoid ease (steady speed, soft start and stop), holds on the hero, the sim and the footer, and clicks the Live Demo's *Play scenario* when the section arrives (the demo only runs while on screen, so the sim hold is 27 s). `&speed` scales holds and pace; Space pauses, R restarts, Esc or any wheel/touch stops. The cursor and back-to-top button are hidden while it runs. `PLAN` at the top of the file sets each section's hold and scroll speed.
- **Verified:** at 6x speed in the built-in browser it ran top to bottom with no backward jumps and finished at the page end. **Not verified:** real-time pacing, the sim autoplay and the total run time, because the browser pane throttles animation while hidden; do one dry run at `speed=1` before recording. The Space Apps video length and format rules still need checking, then tune `PLAN`.

## Full-build pass (after C12, done)
- **A. Check-in rules (`app/src/engine/checkinRules.ts`):** reported symptoms and self-rated sleep quality now raise alerts through the shared lifecycle (`applyRule`, exported from `pipeline.ts`). Illustrative thresholds: the same symptom on 3 check-ins in a row, or 3+ symptoms at once, gives a Watch on the symptom's RIDGE hazard (headache and rash E, nausea, dizziness, congestion, back pain and blurred vision G, fatigue I); **blurred vision on 2 check-ins in a row gives an Act** (SANS red flag, NASA HRP: https://www.nasa.gov/reference/risk-of-spaceflight-associated-neuro-ocular-syndrome-sans/); sleep quality <= 2/5 on 3 check-ins in a row gives a Watch (hazard I). They resolve when a later check-in clears them ("cleared on the latest check-in"). New alert kind `checkin`; one `alertTitle()` helper replaces four copies of the title logic; action steps are keyed by rule id (new symptom steps include an on-board vision check).
- **B. Accessibility:** skip link and focusable `main`; each route sets the document title and moves focus to the content on navigation (not on first load); the crew switcher is a labelled group of `aria-pressed` buttons (it had tab roles without panels); global focus-visible ring; polite live region for the board's alert count; the selected crew member persists across reloads (localStorage, failure-safe). **Verified in headless Chrome:** first Tab reaches the skip link, the crew switcher is reachable and usable by keyboard, an action-card step ticks with Space; **axe-core WCAG 2.1 A/AA: zero violations on all seven screens.**
- **C. Ground transport (`app/src/sync/transport.ts`):** sync goes through a `GroundTransport`. Default is the simulated station (no network). With `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` set at build time, uploads go to a Supabase `action_log` table by REST upsert (idempotent `uid = device:id`), with no SDK dependency. Upload happens before entries are marked synced; a failure keeps them queued (Sync now reports "Upload failed, entries stay queued"; auto-sync stops at the first failed window; the simulator still moves time and shows the error). Ground View reads from the server when one is configured (with a Refresh button and a fallback message), otherwise from this device. Schema and demo-grade RLS policies in `docs/supabase.sql` (anonymous insert/read, synthetic data only); `app/.env.example`. **Not tested against a live Supabase project** (no credentials); the REST calls are tested with a mocked fetch.
- **Fix from browser QA:** saving two check-ins at the same mission time counted as "two in a row" and raised an Act. The rules now count one check-in per mission day (the latest that day replaces earlier ones; `perDay`), and texts say "daily check-ins". Re-verified in headless Chrome: two same-day saves raise nothing; after the simulator's +1 day, blurred vision again raises the Act with the vision-check card, and Gravity goes to Act on the board.
- **D. Code splitting:** every screen except the Status Board is a lazy chunk (the chart library loads only with Trends). Initial JS 781 kB -> 381 kB; all 15 chunks are precached and offline still works (re-verified). Lighthouse on `/app/board`: performance 99, accessibility 100, best practices 100, SEO 100 (FCP 1.7 s, TBT 0 ms).
- **E. Fast first launch:** the demo's readings regenerate from the seed in ~15 ms; only the engine's output (44 baselines, 29 alerts, 75 log entries, 42 kB) ships precomputed in `app/src/data/demo-snapshot.json`. `seedDemo` loads readings + snapshot in one transaction; `computeDemo` is the full engine path. `demo.snapshot.test.ts` recomputes the demo with the engine and fails if the snapshot is stale (regenerate with `npm run demo:snapshot` after engine or generator changes); it also checks the fast seed equals the computed one row for row. **First launch in Chrome: about 15 s -> 1.9 s**, same starting state; offline re-verified. The test suite went from about 63 s to 34 s.
- **F. Landing matches the build:** the Features carousel no longer says "concept / planned for v1 / stretch". Each of the seven cards is marked Live, its text matches the real screen (real alert wording, 24 h / 7 d / 30 d trends, symptom and SANS rules, four scenarios, Ground View, optional Supabase), and an "Open in Console" link goes to that screen; thumbnails are labelled illustrations. Checked in headless Chrome with the built console copied to `landing/app/` (the Netlify layout): cards render, the hero CTA opens `/app/board`, no page errors.
- **G. Log export:** Ground Sync has "Download log (CSV)": the whole on-board log, oldest first, with mission time, UTC time, crew name, kind, alert id, sync state and sync time (`sync/exportLog.ts`; RFC 4180 quoting, spreadsheet-formula neutralising, UTF-8 BOM for Excel). Verified in headless Chrome: the file downloads with all 75 demo entries.
- **H. Robustness and install:** an error boundary per route (a crashing screen shows the error with Try again and a confirm-guarded Reset demo data, and clears when the crew moves to another screen); an "Install app" button appears when the browser offers installation (`beforeinstallprompt`; Safari users use Add to Home Screen); persistent storage is requested after the first check-in or Done (not on load, because Firefox prompts) so the browser will not evict the on-board log. **Chrome DevTools reports zero installability errors** (manifest at `/app/manifest.webmanifest`, scope and start_url `/app/`, standalone, 192/512 icons).
- **I. Safe redeploys:** with code splitting, a console left open across a deploy would ask for chunk files the new service worker had replaced, and that screen would fail. `shell/lazyPage.ts` wraps `React.lazy`: on a failed chunk import it reloads once into the new version (sessionStorage guard, so a truly broken chunk shows the error screen instead of looping). **Reproduced and verified in headless Chrome:** v1 open and controlled by its service worker, v2 built with new chunk hashes and activated, then navigating to Trends in the old page reloaded exactly once and opened Trends on v2 with no error.
- **Tests: 149.** `tsc`, `oxlint`, `npm run build` clean.

## Console visual refresh (done, superseded by §11)
- **Why it looked dated:** the console never loaded its fonts, so all mono text fell back to Courier New; the background was one flat colour, so the glass cards had nothing to blur and read as grey boxes; status was only a 4 px left border.
- **Fix:** Inter + JetBrains Mono (latin variable subsets) bundled in `app/public/fonts` and precached, so offline looks the same; deep-space backdrop (nebula glows, stars, faint HUD grid); glass panels with HUD corner ticks and a status-tinted glow edge; hazard chips and status pills (ACT pulses, reduced-motion respected); larger glowing readiness ring with tick ring; segmented crew switcher; sticky blurred top bar with a glowing active tab (one swipeable row on phones); gradient buttons; chart band gradient, glowing line, mono axes and a glass tooltip.
- **Checked:** all seven screens at 1280 px and 375 px (no horizontal overflow), fonts load, 149 tests, `tsc`, `oxlint`, build clean.

## 11. Console UI/UX v2 — "Living Mission Health" (plan, not started)
The 2026-10-08 refresh above is **superseded**: the owner wants the console to have its own identity (not the landing page look), a professional product feel, charts that look live, and a natural, energetic background that motivates the crew to look after their health.

### 11.1 What the reference images teach (owner's 4 refs)
| Ref | Take | Leave |
|---|---|---|
| Nexabank dashboard | Smoked-glass panels floating over a **real photo**; floating **icon rail**; a **KPI strip** on top; one big smooth "hero" chart; goal cards with progress bars; one warm accent colour | Finance content, too-low text contrast |
| Fitness dashboard | **Full-bleed photo** with a dark scrim; greeting header; a row of **metric cards, each with its own mini chart type** (bars, step line, range bars); waveform score cards; a big **speed-dial gauge** for one headline number | Celebrity-style hero photo |
| Hologram body | A **central anatomical figure** with organ highlights; ECG lines running across panels; thin HUD frames | Noise text, unreadable micro labels |
| AI diagnostics monitor | Body figure with **hotspot rings** on organs; **circular gauges row**; cyan + amber two-tone; node/flow diagram for connections | Decorative fake numbers |

**Direction:** a calm, clinical-grade product (Apple Health × mission control). Photo background for energy, smoked glass for focus, the body as the centrepiece, and every number tied to real engine output. Nothing decorative is fake: where a signal is simulated, it is labelled.

### 11.2 Visual language
- **Background (natural + energetic):** a NASA public-domain photo of **orbital sunrise over Earth** (sunlight breaking over the atmosphere's edge, oceans and clouds below). It means "home, life, a new day" and stays on-mission. Treatment: dark scrim gradient (left/bottom heavier so text sits on ≥ 4.5:1 contrast), 2–4 px blur behind panels, a very slow 60 s drift (off with reduced motion). The sunrise tint warms with readiness: green-gold when nominal, cooler and dimmer when there is an Act alert (subtle, never alarming). Alternatives if the owner prefers: aurora from the ISS, or a green forest/ocean "Earth memories" set that rotates daily. One compressed WebP/AVIF (~150–250 kB), precached for offline; a gradient fallback if it fails.
- **Surfaces:** smoked glass in 3 levels (rail/topbar, cards, nested wells): `rgba(18,20,24,.55/.68/.8)`, 1 px light border at 8 % white, 20 px radius cards / 12 px inner, soft long shadow. No HUD corner ticks, no grid.
- **Colour roles (strict):** brand accent **Solar orange `#FF7A2F`** (active nav, primary buttons, focus chart line) · data accent **Vital cyan `#2DD4E8`** (live signals, baselines) · status only: **Nominal `#3DDC97`**, **Watch `#FFC53D`**, **Act `#FF5A6E`**. Orange is never used for status, so it cannot be confused with Watch.
- **Type:** Inter only for UI (600 tight display sizes for big numbers: 48/32/24, 14 body, 12 labels in caps tracking); JetBrains Mono only for mission time and raw log lines. Tabular numbers everywhere.
- **Icons:** `lucide-react` (tree-shaken, ~1 kB per icon) replacing the text glyphs: hazards (Radiation ☢ → `Radiation`, Isolation → `Brain`, Distance → `Satellite`, Gravity → `Dumbbell`, Environment → `Wind`), nav, actions.
- **Motion spec:** UI 180 ms ease-out; data transitions 600 ms; live loops at ≤ 30 fps on canvas; everything paused when the tab is hidden and replaced by static frames with `prefers-reduced-motion`.

### 11.3 App shell
- **Left floating icon rail** (desktop/tablet): 7 screens as icons with labels on hover/focus, active = orange pill; bottom: install app, settings (motion on/off, units).
- **Top bar:** greeting "Good morning, Pilot" + crew **avatar switcher** (round avatars with a status ring per person, so the whole crew's state is visible from any screen) · **MET clock** ticking every second · **Link widget** (signal bars animate during a window, countdown "next window in 58 min", blackout state) · **Alert bell** with count and dropdown of the top 3.
- **Mobile (< 768 px):** bottom tab bar with 5 items (Board, Alerts, Trends, Check-in, More → Simulator/Sync/Ground), avatar switcher as a horizontal strip.

### 11.4 The "live" layer (key requirement)
The engine data is hourly/daily, so live motion comes from an honest **telemetry simulator** layered on top of real values:
- `useLiveTelemetry(crewId)`: a seeded generator that produces high-rate signals **around the latest real reading and personal baseline** (HR, HRV, SpO₂, respiration, cabin CO₂, dose rate). If the engine says HR 70 bpm, the ECG beats at ~70; if a CO₂ scenario is injected, the CO₂ stream climbs. Labelled "Simulated live telemetry" in the UI and README. It does **not** write to the database or create alerts (the engine stays the single source of truth).
- `<LiveWave>` canvas component: scrolling ECG (PQRST shape at the live HR), pleth wave (SpO₂), respiration sine, with a glowing leading dot and fading tail. 30 fps, device-pixel-ratio aware, pauses offscreen (`IntersectionObserver`) and when hidden.
- `<LiveNumber>`: values tick smoothly (spring) when they change; a soft pulse ring on the heart icon in sync with each beat.
- **History charts that feel alive:** draw-in on load, a pulsing "now" dot at the right edge, the newest point streams in when the simulator advances time, hover crosshair with a glass tooltip. Recharts stays for history; canvas only for live waves (cheap).
- **Flows:** animated SVG paths with moving dash "packets" for data flow (sensors → engine → alert → action card; ship → ground link during windows).
- **Budget:** live layer ≤ 3 % CPU on a mid laptop, no layout thrash, Lighthouse performance ≥ 95.

### 11.5 Screens
1. **Mission Health (Status Board)** — the hero screen
   - Row 1: **Health Twin** centre (SVG body adapted from `landing/twin.js`, translucent cyan, slowly breathing glow) with 5 **hazard hotspots** (head = Isolation, chest = Environment/heart, skeleton/legs = Gravity, whole-body aura = Radiation, ear/antenna = Distance), each coloured by status with leader lines to its card. Left of it the **Readiness speed-dial gauge** (like the fitness ref: 0–100 %, needle animates, status label). Right: **Next action** card (most urgent alert, first step, "Open action card" button).
   - Row 2: **Live vitals strip**: ECG + HR, SpO₂ pleth, respiration, BP, each a small glass card with a live wave.
   - Row 3: **5 hazard cards**, each with a different mini chart that fits the metric (dose: cumulative area; sleep: step line; reaction: dot strip; exercise: bars by day; CO₂: line vs NASA limit), value, delta vs baseline ("+0.4 σ"), status pill.
   - Row 4: **Crew overview**: 4 compact cards (avatar, readiness ring, worst hazard), click to switch.
2. **Alerts** — master/detail. Left: list sorted by urgency with filter chips (Act / Watch / Resolved). Right: big title + status, **"why" panel** with the triggering metric chart (baseline band, the crossing point highlighted, σ value), **action card** as a checklist with a progress ring, **lifecycle timeline** (opened → escalated → steps → resolved), Done button. Mobile: list → full-screen detail.
3. **Trends** — Nexabank-style: metric chips grouped by RIDGE hazard, one **large focus chart** (range 24 h / 7 d / 30 d, baseline band, alert markers, live edge), a stats row (latest, mean, baseline, σ, time outside band), then **small multiples** of all metrics; optional "compare with crew median" overlay.
4. **Check-in** — a 4-step **wizard** (Mood → Sleep → Symptoms → Reaction test) with a progress bar, large illustrated scale buttons, one question per card; reaction test as a large circular target with a satisfying result screen (median vs personal baseline, lapses). Ends with "What happens next" (which alerts this may affect).
5. **Simulator** — "Mission Control": scenario cards with icon, duration, affected metrics; a **time scrubber** (+1 h / +6 h / +1 d / +3 d with an animated clock); a **live event feed** of what the engine did (alert opened, escalated, resolved) as it happens.
6. **Ground Sync** — an animated **link diagram**: ship ⇄ relay ⇄ Earth with packets moving only during a window, a countdown ring to the next window, blackout state shown as a broken link; outbox as a queue of packets; log table with filters and the CSV button.
7. **Ground View** — flight-surgeon layout: "Earth is 12 min behind the crew" banner, 4 crew columns with mini twin + known alerts, "on board, not yet downlinked" counters.

### 11.6 Accessibility and quality gates (unchanged bar)
Text on photo always on a scrim (≥ 4.5:1), status never by colour alone (icon + label), 44 px targets, keyboard and screen-reader paths kept, live waves `aria-hidden` with a text summary that updates politely at most every 30 s, reduced motion = static. Tests stay green (role/label based), `tsc`, `oxlint`, build clean, offline still works (photo and fonts precached), Lighthouse ≥ 95 / 100 / 100 / 100.

### 11.7 Phases (each one session, ship after each)
| # | Phase | Output | Done when |
|---|---|---|---|
| U0 | Design system | Tokens, surfaces, type scale, colour roles, lucide icons, background photo + scrim, remove v1 HUD styles | Every screen re-skinned without layout change; contrast checked |
| U1 | App shell | Icon rail, top bar (greeting, avatar switcher with status rings, MET clock, link widget, alert bell), mobile bottom tabs | Navigation works at 375 / 768 / 1280 px, keyboard OK |
| U2 | Live layer | `useLiveTelemetry`, `<LiveWave>`, `<LiveNumber>`, pause/reduced-motion handling, unit tests for the generator (seeded, follows real values) | ECG matches HR from the engine; CPU budget met |
| U3 | Mission Health | Health Twin with hotspots, readiness gauge, next-action card, vitals strip, 5 hazard cards with mini charts, crew overview | Board tells the full story in one screen; Act state is obvious in < 2 s |
| U4 | Alerts + Trends | Master/detail alerts with why-chart and timeline; focus chart + small multiples with live edge | Full alert → action → resolve flow; all 11 metrics charted |
| U5 | Check-in + Simulator | Wizard, new reaction test screen, mission-control simulator with event feed | A check-in and a scenario both visibly change the board |
| U6 | Sync + Ground | Animated link diagram, packet queue, ground view refresh | Pending → synced visible as motion during a window |
| U7 | Polish + ship | Motion tuning, empty/loading/error states, screenshots for README/landing, Lighthouse + offline + phone check, deploy | Live URL passes all gates |

### 11.8 Owner decisions (2026-10-08)
1. **Background: live orbital sunrise, no photos.** The owner first picked a rotating photo set, then a single sunrise photo, and finally asked for something moving instead of static images. The background is now drawn live in WebGL (`app/src/shell/Backdrop.tsx`). It replaces the photo treatment described in §11.2. Earth's limb from low orbit, procedural oceans/land/clouds sliding under the camera, a blue atmosphere glowing gold near the sun, stars, and the sun rising and setting on a 150 s loop. The mood follows the selected crew member: warm gold when nominal, paler with a Watch, cool and dimmer with an Act. It renders at 30 fps and half resolution, draws a frame immediately and on every resize, pauses in hidden tabs, shows a still frame with reduced motion, and falls back to a CSS dawn gradient without WebGL. No image assets.
2. **Accent:** solar orange for actions, vital cyan for live signals, and the status colours reserved for status only.
3. **Assets:** `lucide-react` approved.

## U0 Implementation Log (done)
- **Design system v2** (`app/src/index.css`, rewritten): smoked glass in 3 levels over the live sky, 20 px cards, orange pill nav and buttons, white segmented crew switcher, Inter for UI and big numbers (JetBrains Mono only for mission time and log lines), status colours only for status, and an Act card with a red-tinted edge. The v1 HUD styles are removed (corner ticks, grid, star field, cyan glows).
- **Icons** (`app/src/shell/icons.tsx`): `HazardIcon` (Radiation, Brain, Satellite, Dumbbell, Wind; the RIDGE letter is kept for screen readers) and `StatusPill` (icon + word, never colour alone). These replace the ●▲◆ glyphs on the board, alerts, trends, ground view and sync link state.
- **Shell:** new brand mark ("AstroDocX · Crew Console"); the top bar stays visible while scrolling (sticky); on phones the nav is one row you can swipe. The full shell redesign is U1.
- **Fixed during QA:** the sky was black when the tab started hidden, and again after a resize cleared the canvas; the first frame and every resize now draw straight away.
- **Checked:** board (nominal + Act), alerts, trends, simulator and sync at 1280 px, board at 375 px (no overflow); 149 tests, `tsc`, `oxlint`, build clean.

## U0.1 Owner feedback pass (done)
- **4K sky:** the backdrop is now two passes (`app/src/shell/backdropShaders.ts`). The soft surface (oceans, land, clouds) renders to a half-resolution texture. The sharp composite renders at device pixels up to 3840 × 2160: anti-aliased limb, a crisp atmosphere line, round stars in three depth layers with a faint shimmer (no on/off blinking), a Milky Way band, and dithering against banding.
- **Sun flare:** core, halo, six/ten-point starburst, anamorphic streak and five lens ghosts along the sun–centre axis, with a gentle shimmer. Strength follows how high the sun is.
- **Layout:** the content area is fluid (up to 1760 px, padding scales with the window). The Status Board on ≥ 1180 px is a dashboard: readiness column on the left, hazard cards 3 + 2 beside it. Alerts go two per row and Ground View shows all four crew in a row; the check-in form is capped at 1080 px.

## U1 Implementation Log (done)
- **Shell:** slim icon rail on the left (≥ 768 px), sticky top bar, and on phones a bottom tab bar (Board, Alerts, Trends, Check-in, plus a More sheet for Simulator, Ground Sync and Ground View; Escape or tapping outside closes it). The old text nav and in-page crew tabs are gone (`board/CrewTabs.tsx` removed).
- **Top bar** (`app/src/shell/Chrome.tsx`): greeting by mission time of day, crew avatar switcher with a status ring per person (colour + icon + word in the accessible name, arrow keys move between people), MET clock, ground-link widget (open / closed / blackout with the countdown and queued count, links to Ground Sync), alert bell with the open-alert count for the selected person, install button. Two rows on phones.
- **Data:** `useShellData` (live query) feeds every screen's shell with each person's worst status, mission time and sync queue.
- **Checked:** 375 / 768 / 1280 px in the browser, more sheet, crew switch; 157 tests, `tsc`, `oxlint`, build clean.

## U2 Implementation Log (done)
- **Generator** (`app/src/live/waves.ts`, `telemetry.ts`): `WaveGenerator` streams ECG (PQRST), pleth and breathing at a given rate; the rate eases toward the real value, and each cycle is stretched by seeded beat-to-beat variability (from the real HRV). `liveValues` = real reading + small seeded wobble (HR ±1.6, SpO₂ ±0.25, CO₂ ±0.03), so it can never disagree with the engine; breathing speeds up as cabin CO₂ climbs.
- **Hook** `useLiveTelemetry(crewId)`: watches the latest real readings (so a simulator scenario changes the live streams), ticks once a second, pauses in background tabs and shows exact still values with reduced motion. Writes nothing to the database and raises no alerts.
- **Components:** `<LiveWave>` (canvas, 30 fps, device-pixel aware, pauses offscreen and when hidden, glowing leading dot, aria-hidden), `<LiveNumber>` (glides to new values), `<LiveVitals>` (heart pulse ring on each beat, screen-reader summary at most every 30 s, "Simulated live telemetry" label). Placed on the Status Board as a first strip; U3 arranges it in the final layout.
- **Checked:** generator unit tests (beats per minute match HR for 48–130 bpm, seeded, eases, follows CO₂); 165 tests, `tsc`, `oxlint`, build clean; strip seen in the browser. Not yet measured: CPU budget and Lighthouse (the browser pane was hidden, so animation frames did not run).

## U3 Implementation Log (done)
- **Board layout** (`app/src/board/`): top row of readiness dial, Health Twin and Next-action card (three columns ≥ 1180 px, two at tablet, stacked on phones); live vitals strip; five hazard cards; crew overview.
- **Readiness dial** (`Dial.tsx`): 240° arc with ticks and an animated needle; same accessible name as before.
- **Health Twin** (`Twin.tsx`): body outline from the landing page, one hotspot per RIDGE hazard coloured by status with a leader line to a label chip that jumps to the hazard card (`#hz-X`). Radiation is a whole-body aura (the outline glows by its status). Chips show icon + word; on phones icon only, with the word in the link name. A slow scan line plays unless motion is reduced.
- **Next action** (`NextAction.tsx`): the most urgent alert, its first open step, progress and a button to the Alerts screen; an all-clear state links to the check-in.
- **Hazard cards:** each has its own mini chart (`MiniCharts.tsx`, plain SVG, no chart library): dose as cumulative area, sleep as a step line, exercise as bars by day, CO₂ against its limit, and for Distance a backlog bar with the 24 h / 72 h marks. A signed σ against the personal baseline shows next to each value.
- **Crew overview** (`CrewOverview.tsx`): four cards with readiness ring and worst hazard, fed by the shell data (now shared through a context); click to switch.
- **Checked:** 168 tests, `tsc`, `oxlint`, build clean; seen at 1440 and 375 px (no horizontal overflow). Not measured: the "Act is obvious in < 2 s" test with real viewers.

## U4 Implementation Log (done)
- **Alerts** (`app/src/alerts/`): master/detail. Left: urgency-sorted list with filter chips (All active / Act / Watch / Resolved, with counts). Right: the chosen alert with a "Why this fired" panel (explanation, σ chip, the triggering metric's chart with the personal band and the crossing point ringed), the action card as a checklist with a progress ring and Done, and a lifecycle timeline built from the on-board log (opened, escalated, each step, action card done, eased, resolved; `timeline.ts`). Resolved alerts open read-only. On phones the list and the detail take turns (Back button).
- **Trends** (`app/src/trends/`): metric chips grouped by RIDGE hazard, one large focus chart (24 h / 7 d / 30 d, band, alert dots, line draws in, pulsing "now" dot at the live edge, glass tooltip), a stats row (latest, mean, baseline ± sd, distance from baseline in σ, share of readings outside the band), an optional dashed crew-median overlay, and the small multiples for all 11 metrics (each has a Focus button). `seriesStats` and `crewMedian` are unit-tested.
- **Shared plot:** `TrendPlot` serves the focus chart, small multiples and the alert chart.
- **Checked:** 176 tests, `tsc`, `oxlint`, build clean; seen at 1440 and 375 px.

## U5 Implementation Log (done)
- **Check-in wizard** (`app/src/checkin/CheckInForm.tsx`): four steps (Mood, Sleep + hours, Symptoms, Reaction test) with a progress bar, one question per card, large illustrated choices (real radio inputs, so keyboard and screen readers work), Next held until answered, Back keeps answers. After saving: "Check-in saved", any alert the engine raised, a "What happens next" list, and buttons to the board, Alerts and a new check-in.
- **Reaction test:** now a large circular target; the result shows the median, taps, lapses and the person's own baseline with the difference (baseline read from the engine, shown once it has 5+ samples).
- **Simulator as mission control** (`app/src/sim/`): scenario cards with icon, duration and affected metrics; a time scrubber (+1 h, +6 h, +1 day, +3 days) with a moving track while it runs; a mission clock that runs up to the new time (`MissionClock`); and a live **Engine event feed** from the on-board log (alert opened, escalated, eased, resolved, with person, word and MET; `feed.ts`). A scenario or a check-in changes the board through the same engine as before.
- **Checked:** 180 tests, `tsc`, `oxlint`, build clean; wizard steps and a solar injection (clock to D30 05:00, feed filled) seen in the browser at 1440 px. Phone width for these two screens not yet viewed.

## U6 Implementation Log (done)
- **Ground Sync** (`app/src/sync/`): an animated link diagram, Ship, Relay, Earth (`LinkDiagram.tsx`). While a window is open the link is solid green and dash packets flow toward Earth (faster with more queued); between windows it is dim and still; in a blackout it is visibly broken. A countdown ring shows the time to the next window or to the window closing (`windowProgress` in `link.ts`, unit-tested). When queued entries are delivered while the screen is open, a burst of packets flies to Earth. The outbox is a grid of packet cards, and a filterable on-board log table (state, kind, person; `LogTable.tsx`) sits below with the CSV button.
- **Ground View:** an "Earth is N behind the crew" banner (time since the last sync plus the one-way delay), four crew columns on wide screens, and a mini twin per person whose glow is the worst status the ground knows about, plus the known alerts and the "on board, not yet downlinked" count.
- **Checked:** 183 tests, `tsc`, `oxlint`, build clean; closed and open windows, the delivery burst (8 packets) and the Ground View seen in the browser at 1440 px. Phone width for these two screens not yet viewed; the mission clock on the simulator only animates while the tab is visible.

## U7 Implementation Log (done, not yet deployed)
- **Checked with real Chrome (puppeteer-core, Lighthouse run from a scratch folder, nothing added to the repo):**
  - All 7 screens at 375 / 768 / 1440 px: no console errors, no horizontal overflow (the Sync log table was widening the page; grid children may now shrink).
  - Lighthouse on `/app/board` (cold first launch): **desktop 100 / 100 / 100 / 100**; **mobile accessibility 100, best practices 100, SEO 100, performance 72**. The mobile number is the one-time first-launch seeding of the demo (about 300 ms of script unthrottled, about 1 s under Lighthouse's 4x CPU slowdown, in one chunk). Not fixed; a Web Worker for seeding is the next step if it matters.
  - Offline: after one visit, reload and navigation to Trends, Ground Sync and Simulator work with the network off (lazy chunks included).
  - Reduced motion: no infinite animation runs on the board or Sync.
- **Fixes found by the audit:** muted text raised to 4.5:1 or better; text on the orange accent changed from white (2.6:1) to a dark ink; avatar, twin-chip and crew-overview names are real text so they match what is visible; the phone top bar reserves its two rows (layout shift 0.125 to 0); a global reduced-motion safety net.
- **README:** feature table and a Crew Console screenshot set (`docs/screenshots/console-*.jpg`).
- **Not done:** deploy (push to `main` triggers Netlify), re-running Lighthouse on the live URL, install-to-home-screen on a real phone, turning off Netlify site protection, the README video URL.

## U3.1 Health Twin hologram (owner feedback)
- The twin is now an anatomical hologram like the owner's reference (`app/src/board/anatomy.ts`, `Twin.tsx`): glass body, skeleton (skull, spine, ribcage, sternum, clavicles, pelvis, arm and leg bones, joints), brain, lungs, liver, stomach, kidneys, intestine, arteries and veins, sparkles, a scan line and a holographic floor.
- **Live heart:** beats (lub-dub) in step with the ECG on the vitals strip through a shared heartbeat (`live/heartbeat.ts`); when the ECG is off screen it keeps the same rhythm from the heart rate. Each beat sends a pulse wave out along every artery; veins flow back. Still with reduced motion or in a background tab.
- **Status on the body:** brain takes the Isolation status, lungs Environment, leg bones Gravity, the whole-body aura Radiation.
- **Checked:** 186 tests, `tsc`, `oxlint`, build clean; twin seen at 1440 and 375 px; all 7 screens at 3 sizes without overflow or console errors.

## L4 Implementation Log: 3D anatomy viewer (done)
- **What:** an opt-in "Explore real anatomy in 3D" button in the Health Twin header opens a modal with the Sketchfab model *Animated human body anatomy* by AVRcontent (UID `51ebbf617d4f4faeb099d70336e13a58`). The Health Twin itself is unchanged.
- **New files (isolated, template JS untouched):** `landing/anatomy3d.js`, `landing/anatomy3d.css`. `index.html` gained the trigger button, the `#anat3d` dialog (before the CDN scripts) and the two includes.
- **Performance:** the iframe is created on open and removed on close, so there is no extra WebGL context until a visitor asks for it, and it is freed afterwards. Nothing loads on page load.
- **Accessibility:** `role="dialog"`, `aria-modal`, focus moves to × on open and back to the trigger on close, Tab is trapped, Esc / backdrop / × close it, page scroll locked while open. The site's custom cursor is hidden while open and the native cursor is restored inside the dialog (the custom cursor cannot follow the pointer over an iframe).
- **Credit:** model title, author and Sketchfab linked in the dialog footer; "Sketchfab embed (3D anatomy)" added to the Built On landing-page chips. Footer note: "Reference model, not crew data · needs internet".
- **Scope:** landing page only. The Crew Console stays offline-first and keeps its SVG twin (a Sketchfab iframe would be blank offline).
- **Checked (headless Chromium, 1440×900 and 390×844):** button visible in the Twin header; open creates one iframe, focus on ×; Esc closes, removes the iframe, unlocks scroll, returns focus; no horizontal overflow; no new console or page errors. The Sketchfab model itself could not load in the sandbox (no network to sketchfab.com), so the live render still needs a look in a normal browser.

## R1 Implementation Log: Copy + data truth pass (done, 2026-10-08)
- **Scope:** landing copy only; the console (`app/`) is untouched. Not pushed (§13.4).
- **Hazards:** each card lists only real metrics and the real rule (R dose rate + 250 mSv/24 h event limit; I sleep, mood, reaction test, sleep+reaction rule; D outbox, link windows, Watch 24 h / Act 72 h; G exercise, HR, HRV; E CO₂ vs 3 mmHg, SpO₂, temp, noise, symptoms). BP and vision self-test removed (now Roadmap).
- **Health Twin:** panels rebuilt for the real systems: Isolation·Brain, Environment·Air, Radiation·Whole body, Gravity·Heart (live ECG), Distance·Ground link, Gravity·Legs. Numbers are the **Pilot's** end state in the seeded demo mission, taken from the real engine (`loadSnapshot`): sleep 4.7 h (3.4σ), reaction 411 ms (4.3σ), mood 3, CO₂ 2.11, SpO₂ 96.3, dose 32.4 µSv/h, HR 59, HRV 59, exercise 122 min, 10.5 h since sync, 3 pending, **readiness 83 (Act)**. The brain panel is amber from the start (it is a true Act state); the action card is the engine's real Isolation/Act card. Tag changed to "Demo mission data · Pilot". Hotspots: eyes/bone removed, lungs + link added (`index.html`, `twin.js`, `twin.css`).
- **Mission Simulator (landing mini sim):** buttons renamed to the console scenarios (+ link blackout), action-card steps copied from `engine/actions.ts`, readiness now uses the console formula (mean of five hazard scores, status caps 100/80/55) and Nominal/Watch/Act labels, "Run the real simulator →" links to `/app/simulator`, note explains what is cited vs illustrative.
- **How It Works:** one real detail per step (11 metrics + learn-only-while-nominal; explainable wording; action card lifecycle; IndexedDB offline; outbox, 12-min delay, CSV, Ground View).
- **Built On:** "next" wording removed (both stacks Live), real detection description, new dashed **Roadmap** block (wearables, Supabase ground backend, vision/SANS, BP, bone density, multi-device ground station).
- **Team:** `landing/team.js` holds the `TEAM` array (6 entries: Alif Mahmud + 5 placeholders; fields name, role, github, linkedin, photo; empty fields hidden). 3×2 grid, 2 columns tablet, 1 phone; project info card below.
- **Other:** meta description, OG and Twitter text, JSON-LD, hero proof line, marquee (only console metrics), problem closing line links to the console, typewriter phrase "tracking exercise load and HRV", footer "Prototype, not a medical device". README rewritten with the §13.1 table and a Roadmap line.
- **Checked (headless Chromium, CDN libs served locally):** no page or console errors at 1440×900 and 390×844; 6 team cards, no horizontal overflow; Twin ends at 83% with the brain panel amber and the action card visible; mini sim reaches ACT after injecting insomnia (readiness drops to ~90). Counters for the proof strip are R2 work.

## R2 Implementation Log: Real visuals (done, 2026-10-08)
- **Screenshots:** the 8 concept SVGs in `landing/assets/features/` are deleted and replaced by webp (1200×750, ~30–55 KB each): Status Board, Alerts, Check-in, Trends, Simulator, Ground Sync, Ground View (console, Pilot selected, seeded demo mission, taken at 1440×900 from the production build with reduced motion) + Health Twin (landing, end state, readiness 83). Retake after any UI change: build, `vite preview`, shoot each route.
- **Carousel:** `PROJECTS` in `script.js` is now 8 real-screenshot cards (Action Cards merged into "Alerts & Action Cards"; Ground View and Health Twin added), each with a one-line "what you can do" and an "Open in Console" deep link (`/app/board`, `alerts`, `checkin`, `trends`, `simulator`, `sync`, `ground`). Card, dot and count logic is DOM-driven, so nothing else changed.
- **Proof strip (`#proof`, after How It Works):** 11 metrics · 5 hazards · 7 screens · 186 automated tests · Lighthouse accessibility 100 · works offline. **Verified:** metrics from `data/types.ts`; screens from `shell/nav.ts`; tests = `vitest run` (40 files, 186 tests, all pass; `AlertsPage.test.tsx` once failed only while the machine was loaded and passes alone); Lighthouse (mobile, local production build) accessibility 100, best practices 100, SEO 100. Performance (0.43) is not claimed: this sandbox renders the WebGL backdrop in software, so re-run it on the deployed URL.
- **Console wording:** "Concept prototype" changed to "Prototype" in the footer, Ground View/Ground Sync notes, `index.html` meta and the PWA manifest (no test depended on it).
- **README:** console and Health Twin screenshots refreshed (`docs/screenshots/`).
- **Checked (headless Chromium):** 8 cards and 8 dots at 1440 and 390 px, images load (1200 px wide), no page or console errors, no horizontal overflow, proof counters finish at their targets.

## P0 Implementation Log: Universe skeleton (done, 2026-10-08)
- **New folder `landing/universe/`:** `scenes.js` (the `ADX_SCENES` config: 7 scenes with copy from §12.2, hold windows from §12.3, text position; `ADX_PIN` = 800% desktop / 600% mobile), `universe.js`, `universe.css`. `index.html` gets the stylesheet, the `#universe` section (before the old `#hero`, which stays until P4) and the two scripts. Template JS is untouched.
- **Section:** pinned `#universe` (`+=800%`, scrub 0.8, `refreshPriority: 1`, then `ScrollTrigger.sort()` + refresh so About, Skills/Projects, Twin pins recompute). Opaque and `z-index: 2`, so it covers the always-on nebula exactly like the hero does; nebula pause hook stays P4.
- **Master progress `p`:** a pure function of scroll. Drives scene text (real `<article><h2>` + `<p>` per scene, fade inside the morph window; scenes that abut fade inside their own hold so two never overlap), the progress rail (7 ticks, scene name on hover, click = jump to that hold, `aria-current`) and the camera (placeholder dolly 14 → 5; P3 swaps in the Catmull-Rom path).
- **Renderer:** one three r128 WebGL context, 3-layer starfield (3000 / 1500 / 600 stars, 1500 / 750 / 300 on the low tier), shader sprites with twinkle and colour mix (white / blue / gold), additive, ≤35% brightness. DPR cap 1.75 / 1.25. Loop runs only while on screen and the tab is visible; context-lost handler; desktop mouse parallax ≤1.5°.
- **Chrome:** Skip intro (lands on scene 07 at p = 0.97, keyboard reachable, hidden once in scene 07), "Scroll ↓" hint, `?skip=1`, `window.ADX_UNIVERSE.scrollToP(p)` for tests and the tour.
- **Reduced motion:** no pin, no canvas, the 7 scenes stack as plain text sections (static shape frames come in P5). **No WebGL:** text-only pin (poster fallback is P5).
- **Checked (headless Chromium with software WebGL, CDN libs served locally):** pin 0 → 7200 px; at p = 0, .22, .42, .595, .755, .895, .97 exactly scenes 1–7 are visible and the rail follows; jump back to the top and Skip intro both land in the right scene; About, nebula, Twin pins all still register and the page order is intact; 1440 and 390 px have no horizontal overflow; reduced motion stacks the text; no page errors. **Not measurable here:** frame rate (software WebGL gave ~6 fps for the whole page, so the 60 fps budget needs a real GPU check in P5).

## P1 Implementation Log: Particle engine + procedural shapes (done, 2026-10-08)
- **New `landing/universe/engine.js`** (`window.ADX_ENGINE.create(scene, {tier})`): one `THREE.Points`, one draw call. 7 target shapes are vertex attributes `aP0..aP6` plus `aSeed`; the vertex shader picks shape `uSeg` and `uSeg+1` and mixes them with `uT`, so position is a pure function of scroll (reverse, fast scroll and jumps cannot break it). Staggered morph (random + height), curl-style dissolve peaking mid-morph (`uDis`, stronger into the wordmark), idle breathing, per-shape scale / offset / spin / tint, soft Gaussian sprite with halo, additive, white / blue / gold mix.
- **Shapes (procedural stand-ins, P2 replaces astronaut / Orion / TDRS / Earth with baked bins):** dust cloud, planet with tilted orbit ring (8% of points), ellipsoid astronaut, Orion-like cone + service module + 4 wings, TDRS-like bus + panels + dish, Earth with noise land mask (dense land, sparse ocean) + cloud shell, and the **ASTRODOCX wordmark** sampled from a canvas in Pulchella (rebuilt once the font has loaded; `onChange` re-renders).
- **Morton (Z-order) sort** of every shape so particle i lands in the same region in every shape (cleaner morphs). Tiers: 24k high / 8k low by striding the sorted arrays (silhouette kept).
- **Config:** `ADX_MORPH.hero = [0.93, 0.98]` (particles converge to the wordmark); the scene-07 text hold moved to `[0.985, 1.00]` so the hero text waits for the wordmark. Placeholder camera: approach z 14 to 9 over p 0 to 0.16, then fixed (P3 does the Catmull-Rom path).
- **Wiring:** `universe.js` creates the engine after the starfield and calls `engine.setProgress(P, time)` in the loop and in `renderOnce`; `index.html` loads `engine.js` before `universe.js`. `.claude/launch.json` gets a `landing` static server (port 4180).
- **Checked (real Chrome pane, GPU WebGL):** no shader or console errors; scenes 02 to 07 render at their hold points with the right text and rail state; shapes sit clear of the text side. Tuned brightness and scales after the first look (Orion wings, relay panels, astronaut size).
- **Known / next:** the wordmark overlaps the scene-07 text until the P4 hero layout moves the text below it; shapes are crude until P2; no planet terminator shading, heartbeat, engine trail, data packets or mouse repel until P3. The pane reports `visibilityState: hidden` between screenshots, which pauses rAF, so scripted scroll tests need a screenshot first; frame rate still needs a real-GPU check in P5.

## P2 Implementation Log: Bake pipeline (done, 2026-10-08; model files still needed)
- **`tools/bake-particles.mjs`** (Node, no dependencies, so it runs offline): reads a binary `.glb` (own small parser: node transforms applied, indexed / non-indexed triangles; Draco, meshopt and sparse accessors are rejected with a clear message), area-weighted triangle sampling with a seeded PRNG, normalises to a Y-up unit box (`--axis x|y|z` for the source's up), Morton-sorts, writes Int16 x,y,z (24k points = 144,000 bytes). `--earth-mask <bmp>` bakes a Fibonacci-sphere Earth: dense on land, sparse (`--ocean 0.22`) on ocean, plus a cloud shell (`--cloud 0.04`); BMP made from a Blue Marble / land-mask image with `sips -s format bmp`.
- **Runtime (`engine.js`):** fetches `universe/targets/{astronaut,orion,relay,earth}.bin` in parallel; a missing, 404 or wrong-size file leaves the procedural stand-in, so the page never breaks. Loaded bins swap into the GPU attribute and re-render.
- **`landing/universe/targets/README.md`:** how to bake plus a credits / licence table to fill in.
- **Checked:** a synthetic 12-triangle GLB (child node translated, parent scaled) baked to exactly +-1 x, +-0.5 y/z; a synthetic BMP mask baked; the box bin dropped into `targets/` replaced the Orion scene in the real page (then removed); scenes without a bin still use the fallbacks, no errors.
- **Not done (needs you):** the real models and licence check. I did not download anything. Candidates to check: NASA 3D Resources (nasa3d.arc.nasa.gov, Orion, TDRS, a spacesuit/astronaut) and NASA Visible Earth Blue Marble / land mask (public domain). Put the files anywhere, or send me the links to download, then run the commands in `targets/README.md`; fill the licence table and the README credits. Until then the intro runs on the procedural shapes.

## P3 Implementation Log: Camera + scene FX (done, 2026-10-08)
- **`universe/camera.js`:** Catmull-Rom path, one key per scene (position, look-at, FOV) with smoothstep between keys, so motion is smooth, capped and reversible; `ADX_CAMERA.at(p)`. Scene 04 FOV kick 52 to 57, scene 06 push-in, scene 07 frontal. Replaces the P1 placeholder dolly. Mouse parallax stays <= 1.5 deg (desktop).
- **`universe/fx.js`** (small extra Points systems, all pure functions of p and time): **ECG line** of particles under the astronaut with a sweeping bright head, **engine trail** streaming back from the Orion engine, **small far Earth + 4 data-packet bursts** travelling along an arc from the relay dish to it (scene 05).
- **`engine.js` shader additions:** **heartbeat** (a ripple leaves the chest once a second, lub then a softer dub, brightening the ring), **mouse repel** (radius 0.6, desktop with a fine pointer only; the cursor ray hits the z = 0 plane), **planet terminator** (lit side brighter). Scene weights `engine.weights[]` shared with fx. Orion no longer spins (trail anchor); astronaut resized to 2.1 and raised so the ECG sits under the feet in frame.
- **Reload fix (found while testing):** with the browser's restored scroll, a reload mid-intro made ScrollTrigger measure the pin while scrolled (start = -4638, every scene off). `universe.js` now sets `history.scrollRestoration = 'manual'` and starts at the top unless the URL has a hash.
- **Checked (real Chrome pane):** astronaut with chest ripple and ECG line (03), Orion with trail (04), relay with data-packet arc and far Earth (05); no JS errors; the only 404s are the 4 `targets/*.bin` files that do not exist yet (fallbacks used). Reload at deep scroll now gives pin start 0.
- **Not verified:** the pane reports `visibilityState: hidden` between screenshots, so requestAnimationFrame / the GSAP ticker pause and scripted scrolls often do not update; so mouse repel, planet shading (02), scene 06 push-in and the ECG tail were not seen, and frame rate is still unmeasured. Check these on a real GPU in P5.
- **Repo note:** the app copied the session into the repo as `ex/` (the earlier zips and a nested copy); the working project was merged into the repo root. Delete `ex/` before committing.

## P4 Implementation Log: Hero replaced by the universe (done, 2026-10-08)
- **Old hero removed:** the `#hero` section (2D warp canvas, wireframe orb, 3D astronaut canvas, typewriter block), `landing/astronaut.js` and its script tag, the hero entrance (G1), the hero-canvas cross-fade (G5b), the warp and orb scripts, and the hero CSS (`#hero*`, `.hero-inner`, `.hero-name`, `.hero-scroll-hint`, `.scroll-mouse`, hero terminal, `#astronaut-canvas`, `#orb-canvas`) are gone. The CSS scroll-snap rule (it only snapped `#hero`) is removed too. Grep for `hero` in `script.js`, `tour.js`, `styles.css`, `index.html` is clean (only `#hero-typed` / `.hero-*` classes reused by scene 07 remain). Nav logo and footer "Top" now point at `#universe`; `tour.js` starts at `universe`.
- **Scene 07 is the hero** (`#uniHero` in `index.html`, adopted by `universe.js`): the particles form the ASTRODOCX wordmark at the top, and below it the eyebrow, pitch, action typewriter (detecting drift / explaining the change / acting on the card / syncing to Earth), proof line "Working PWA · offline · 4-crew demo mission inside", CTAs **Launch Crew Console** (`/app/`), **Watch the tour** (`?tour=1`), **GitHub**, and "Scroll to explore". A visually hidden `<h1>` keeps the page heading for SEO and screen readers. Wordmark enlarged (sc 2.1, y 1.9) and the final camera looks lower so it sits above the block.
- **Text polish:** headline letter-spacing eases 0.4em to 0.12em on enter (`--ls`), blur / rise as before.
- **Nav:** hidden (`.nav-hidden`) while the pin is in scenes 01 to 06; shown from scene 07 (forced past the template's hide-on-scroll-down).
- **Cursor:** the site cursor ring grows and shows SKIP / LAUNCH / WATCH / GITHUB / EXPLORE over `[data-cursor]` elements.
- **Nebula pause hook:** `window.ADX_NEBULA_PAUSED` is set from the universe IntersectionObserver; `script.js` nebula `tick` skips rendering while it is true (one guarded line). The universe is opaque, so nothing visible changes; the nebula resumes as the intro scrolls out.
- **Portrait:** the camera pulls back by 1.2 / aspect (max 2.4x) so shapes and the wordmark fit a phone; scene 07 looks lower on portrait; the hero block gets a compact mobile layout (tagline hidden, 2-up buttons).
- **Checked (real Chrome pane, desktop + 375 px):** scene 01 with nav hidden and nebula paused; scene 07 with wordmark, copy, buttons and nav; scrolling out of the pin into the marquee and nebula; no horizontal overflow at 375 px; no script errors. **Not run:** full-page nebula QA down to the contact section, Lighthouse, mouse-label states, a real-GPU frame-rate check. The pane pauses animation when hidden, so scripted scroll checks need a screenshot first.
- **Left for P5:** reduced-motion static posters, no-WebGL poster, adaptive tier drop, mid tier, tour stops for the 7 scenes, full QA at 1440 / 1024 / 390 px. The scene-07 entry in `scenes.js` (head / sub copy) is now unused by the DOM (the hero markup replaces it) but still drives the rail and timing.

## P5 Implementation Log: Fallbacks, tiers, tour (done, 2026-10-08)
- **Tiers (`engine.js`, `universe.js`):** high 24k / mid 14k / low 8k particles. Slots are now a seeded shuffle of the Morton-sorted shapes, so any prefix is a uniform subsample of every shape: `drawRange` changes the tier with no rebuild (baked bins and the wordmark rebuild use the same permutation). Stars draw a prefix too. DPR cap 1.75 / 1.5 / 1.25; brightness and size compensate a little for fewer points.
- **Adaptive drop:** smoothed frame time above 22 ms for 2 s moves one tier down (high to mid to low), never back up (first 45 frames ignored). `ADX_UNIVERSE.tier` / `setTier()` for tests.
- **Reduced motion (static mode):** no pin, no loop; the 7 scenes stack as sections and each gets a **poster rendered once from the real engine** (1280x720, shape fully formed, jpeg data URL as `--poster` behind a dark scrim), redrawn when the wordmark font or a baked bin finishes loading. Scene 07 is last in the DOM and padded so the wordmark shows above its copy. `?reduce=1` forces this path for QA.
- **No WebGL:** the same stacked layout, text only (no poster files; the plan's `assets/universe/*.webp` posters were replaced by the runtime posters, which need WebGL). Context loss mid-session still leaves the pin with text only.
- **Tour (`tour.js`, `scenes.js`):** `?tour=1` now stops at each of the 7 scene holds (dwell seconds per scene in `scenes.js` `tour`: 2, 3, 4.5, 3, 3.5, 3, 6) with 330 px/s glides between them so the morphs read, then continues down the page. `ADX_UNIVERSE.yAt(p)` and `.stops()` expose the positions.
- **Checked (real Chrome pane):** `?reduce=1` gives no pin, 7 posters, scenes in order 01 to 07; manual `setTier('low')` on the astronaut scene still reads clearly; `?tour=1&delay=0&speed=2` scrolled through scenes 01, 02 (planet with lit side and terminator) and on to 03. No script errors.
- **Not done / for P6 or a real-GPU pass:** 1024 px width and the full 1440 / 390 sweep with the final models, frame-rate and the adaptive drop on a real GPU (the pane pauses rAF when hidden), Lighthouse, a no-WebGL screenshot, a full tour recording.

## S1 Implementation Log: Short page, Option 2 (done, 2026-10-08)
Owner decision: keep only the Health Twin from the old page. New flow: **#universe (6 scenes, ends on Earth) -> #twin ("Meet our health care system") -> #astrodocx (reveal) -> #contact (team) -> footer.**
- **Removed from the page:** About / Problem, Hazards, Features carousel, mini simulator, How It Works, proof strip, Built On, Roadmap, the telemetry marquee, the shared purple nebula (`#nebulaStage`, second WebGL context), and the files `sim.js`, `sim.css`, `built.css`. `script.js` was replaced by a small file (nav, mobile toggle, back-to-top, footer year, typewriter, reveals, copy-repo button). The nav is now Health System / AstroDocX / Team / Launch Console.
- **Universe:** 7 to 6 scenes. Holds: 0 to .08, .16 to .30, .38 to .52, .60 to .70, .77 to .87, .93 to 1.00; pin 700% desktop / 550% phone. The wordmark shape, `genWordmark`, the font-reload hook, `ADX_MORPH` and the scene-07 hero block are gone; the engine has 6 shapes (`aP0..aP5`). Camera keys re-timed; Earth moved lower so it clears the headline. Nav returns and Skip hides at the last scene; **Skip intro and `?skip=1` go to the Health Twin** (the pin's end).
- **Health Twin:** heading is now "Meet our health care system", with the lead-in "Astronauts have to look after their health, far from any doctor. Every crew member gets a Health Twin: one body scan, six systems, one readiness score." Background is the same near-black as the rest (`#twin`, `#contact` solid `#02030a` with a faint cyan wash).
- **AstroDocX reveal (`#astrodocx`):** big gradient ASTRODOCX wordmark in Pulchella (CSS, with a faint twinkling star layer), the pitch, the typewriter, a 5-step strip (Detect 11 metrics vs your baseline / Explain / Act / Log / Sync later with 12-minute delay and CSV), buttons Launch Crew Console, Watch the tour, GitHub, and the proof line. It carries the page `<h1>`.
- **Tour:** `?tour=1` runs intro scene stops, then twin, astrodocx (7 s), contact.
- **Checked (real Chrome pane):** desktop: scene 06 of 06 with nav back, the Twin on dark, the reveal, Team; no console errors; 375 px: reveal and layout fit, no horizontal overflow; no dangling `#anchors`.
- **Not re-checked after this change:** reduced-motion posters (`?reduce=1`) and the tier drop with 6 shapes, full tour run, Lighthouse, a real-GPU frame rate. Earlier P-phase notes about scene 07 / the particle wordmark are superseded by this section.

## S2 Implementation Log: Particle wordmark reveal back (done, 2026-10-08)
Owner feedback: the AstroDocX part was better with the particle wordmark.
- **`landing/universe/reveal.js` (new):** `#astrodocx` is a short pinned section (+=300% desktop, +=240% phone, scrub, `refreshPriority: -1` so it refreshes after the intro and Twin pins). It owns its own WebGL canvas (`#adxCanvas`, transparent over the CSS glow and stars), so the intro's context is not reused or moved. Progress: 0 to .40 the starfield gathers into the **ASTRODOCX wordmark** (centred, large); .40 to .50 hold; .50 to .75 the wordmark rises and shrinks; .55 to .80 the eyebrow, pitch, typewriter, 5 step chips and buttons fade in below; then hold.
- **Engine reveal mode (`engine.js`):** `ADX_ENGINE.create(scene, { reveal: true })` builds only dust and the wordmark (`genWordmark`, sampled from a canvas in Pulchella, rebuilt back from P1), seven attributes (`aP0..aP6`), and a new `uSegB` uniform so any shape pair can morph; `engine.setPair(a, b, t, time, override)` drives it (override = target scale / offset). The intro still uses 6 shapes; reveal mode skips the baked-bin fetches.
- **Fallback:** reduced motion (or `?reduce=1`) or no WebGL: no pin, the section is a normal section with the CSS gradient wordmark (the page `<h1>`) and a plain fade-in. In particle mode the `<h1>` stays in the DOM, visually hidden.
- **Layout:** particle mode shows the steps as compact chips (desktop) and hides steps and tagline on phones; content sits in the lower half under the wordmark. Tour stop timing: the astrodocx entry now glides through the pin at 210 px/s.
- **Checked (real Chrome pane):** pin order intro, Twin, reveal; cloud at p .2, wordmark at .45, final layout at .92 (desktop); 375 px final state fits with no horizontal overflow; `?reduce=1` gives no reveal pin and the CSS wordmark; no console errors. Wordmark size was increased after the first look (3.2 to 2.1).
- **Not re-checked:** full tour, tier drop, Lighthouse, real-GPU frame rate (two WebGL contexts exist on the page: the intro, idle once scrolled past, and the reveal).

## S3 Implementation Log: Health Twin made of particles (done, 2026-10-08)
Owner request: replace the old Health Twin (SVG body, glass panels, canvas-2D particles) with a particle-made twin in the new style.
- **`landing/universe/health-twin.js` (new)** and a rewritten `#twin` section: one WebGL canvas, one draw call, ~18k particles (9k to 11k on phones and low-end): skin shell, skeleton (spine, ribs, pelvis ring), brain, heart, two lungs, gut, legs, a transmitter on the right forearm, and a floor ring. Slots are shuffled so a draw-range prefix is a uniform sample.
- **Scroll (pin +=480% desktop, 420% phone; `refreshPriority 0`):** 0 to .20 the starfield gathers into the body (feet first, curl dissolve); .20 to .30 a scan line sweeps head to feet and each region lights as it passes; .30 to .84 six systems, one every 0.09 (Isolation brain, Environment lungs, Radiation whole body, Gravity heart, Distance link, Gravity legs): the region glows, its reading fades in beside it with a leader line (SVG, projected from the 3D anchor); .86 to 1 crew readiness 83% (counts up) and the real Pilot action card, with the six labels dimmed.
- **Live:** the heart beats once a second (lub, softer dub) and sends a ripple through the body; lungs breathe; the brain pulses amber (the Pilot's ACT alert, with an amber leader line); gentle sway; cursor repel on desktop.
- **Text style:** plain text blocks in the intro's type (mono kicker with status dot and OK / ACT chip, readings, baseline note), no glass cards. Same demo-mission numbers as before. The opt-in "Explore real anatomy in 3D" button (L4) stays in the header.
- **Phones:** header compact, body fills the middle, only the current system's caption shows at the bottom. **Reduced motion / no WebGL (`?reduce=1`):** no pin or canvas; the six systems and the readiness / action card become a plain grid.
- **Removed:** `twin.js`, `twin.css` and the old section markup. `ADX_TWIN.yAt(p)` is exposed for tests. Tour pace through the twin is 200 px/s.
- **Checked (real Chrome pane):** gather and scan, a mid stage with the amber brain and its leader line, all six labels, the readiness / action card; 375 px (two camera distances tried, k = 1.3 kept, no horizontal overflow); `?reduce=1` static grid; pin order intro, twin, reveal; no console errors.
- **Not checked:** frame rate on a real GPU (now three WebGL canvases exist in total, two active at once at most), Lighthouse, the full tour, labels at very short viewports (< 600 px tall), tier drop on the twin (it uses a fixed draw count, no adaptive drop).

## S4 Implementation Log: One sky for every section (done, 2026-10-08)
Owner question: why did the particle Health Twin's background differ from the intro's?
- **Cause:** the twin had only the flat base colour plus a cyan radial glow, no stars; the AstroDocX reveal used a third variant (CSS dots and a glow).
- **`landing/universe/stars.js` (new):** the shared starfield (three twinkling white / blue / gold layers, tiers high 3000/1500/600, mid, low, draw-range prefix, brightness <= 35% of the main particles), extracted from `universe.js`, which now uses it too. `ADX_STARS.create(scene, {tier})` returns `setTime`, `setPR`, `setBright`, `setTier`, `dispose`. The twin and the reveal use it at brightness 0.5 (their camera is nearer, fewer stars in view).
- **Backgrounds:** `#twin` and the particle-mode `#astrodocx` are now the plain base `#02030a` (the cyan glow and the CSS dots are gone in particle mode; the dots stay for the no-WebGL fallback), with the same edge vignette as the intro (`::after` radial scrim).
- **Checked (real Chrome pane):** twin at p .40 and .62 and the reveal at .92 show the same sky as the intro; intro still renders; no console errors. Not re-checked: phone widths and the tier drop with the shared module, frame rate (three canvases).

## Current Phase
**C0–C12 done and deployed. Console v2 (U0–U7) and L4 (3D anatomy viewer) done locally. Landing sprint: R1, R2, P0 and P1 (particle engine + procedural shapes) done locally 2026-10-08. P2 (bake pipeline) done, waiting on real model files. P0 to P5, S1 (short page) and S2 (particle wordmark reveal) and S3 (particle Health Twin) done. Next: P6 (ship): check reduced-motion and the tour on the short page, Lighthouse, OG image, README screenshots, deploy, video. Nothing pushed yet (§13.4).**

## Next Roadmap
0. **Landing sprint rule:** no push until P1–P6 are done; zip after every phase, one push at the end (§13.4).
1. **P6 — Ship** (§12.12): Lighthouse, OG image from scene 07, README screenshots, deploy (one push at the end, §13.4), record the video. Owner: supply the NASA model files / links for the P2 bake (see P2 log). Then **P4 → P6**, one session each; old hero removed in P4.
2. Open decisions (§12.11, defaults used): copy lines (AstroDocX-tied), real NASA models for Orion/TDRS.
3. **L4 check:** open the landing page online, click "Explore real anatomy in 3D", confirm it renders and closes cleanly at desktop and phone width.
4. **Deploy:** live at https://astrodocx.netlify.app (console at `/app/`), auto-deploys from `main`. To do: turn off Netlify site protection, re-run Lighthouse (performance) on the live URL, check install-to-home-screen on a phone. The console wording change (Prototype) ships with the push.
5. Owner inputs: data for the 6 team members (edit `landing/team.js`), README video URL.
6. Record the video after the intro ships (tour mode gets the 7 intro stops in P5).
7. Optional: Supabase ground backend (`docs/supabase.sql`, `VITE_SUPABASE_*`), authenticated policies before any real data.
