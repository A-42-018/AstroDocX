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

## Current Phase
**C12 stretch (Ground View) done; C11 Ship done except the live deploy.** C0-C10 and the landing page are done.

## Next Roadmap
1. **Deploy (owner):** connect the repo to Netlify (config is in `netlify.toml`), then put the live URL in README, the landing `og:image` / canonical tags, and re-run Lighthouse on the live URL. Check install-to-home-screen on a phone.
2. Optional: Supabase backend for real ground sync (needs owner's project and keys).
3. Content still open on the landing page: team cards 2–4, README live/video URLs, absolute `og:image` after deploy.
4. Record the video (tour mode is ready; see README), after the deploy.
