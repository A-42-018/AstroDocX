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

## Current Phase
**C4 Rules + actions done.** C0-C3 and the landing page are done.

## Next Roadmap
1. **C5 Status Board UI:** crew switcher, 5 hazard tiles from the engine output, readiness ring, mission clock (Zustand store; reads baselines and open alerts from Dexie). No browser QA before C11, so verify with unit tests on the selectors and `npm run build`. Then commit + push.
2. C6 → C11 in order (§9.2), one phase per session, commit + push after each.
3. Content still open on the landing page: team cards 2–4, About counter citations, README live/video URLs, absolute `og:image` after deploy.
4. Video (`tour.js` + recording) after C11.
