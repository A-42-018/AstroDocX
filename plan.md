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

## 9. Later Phases — Crew Console (after submission)
- **C1 Data:** types, cited thresholds, Dexie, synthetic generator, 4 scenarios
- **C2 Engine:** baseline, z-score/EWMA anomalies, rules → alerts, action-card library, tests
- **C3 Console UI** (React + TS PWA, same theme): Status Board, alerts → action cards, trends, check-in + reaction test, simulator panel
- **C4 Stretch:** Supabase delayed ground sync, flight-surgeon view, crew view, AI weekly summary
- **C5 QA:** offline PWA test, Lighthouse; link the console from the landing CTA "Launch Crew Console"

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

## Current Phase
**Landing Page Sprint — L1, L2, L2.5 and L3 complete** (video/tour deferred). The page is feature-complete: Hero, Problem, Hazards, Features, Health Twin, Live Mission Simulator, How It Works, Built On, Team. What is left is content (placeholders) and deployment.

## Next Roadmap
1. **Fill the placeholders:** team cards 2–4 (names, roles, GitHub/LinkedIn), README live + video URLs, cite the About counters (Mars signal delay ~3–22 min; ~3-year round trip).
2. **Deploy:** push to `A-42-018/AstroDocX`, connect Netlify (publish `landing/`), then switch `og:image` / `twitter:image` to the absolute URL (`https://<site>/assets/og-image.png`) and check the preview in a link debugger.
3. **Real-device check:** Health Twin pin length (`end: '+=150%'` in `twin.js`), simulator on a phone, Safari/Firefox.
4. **Video (when ready):** check the Space Apps video rules, add `tour.js` (`?tour=1`, include stops for `#twin` and `#sim` with *Play scenario*), record with OBS 1920×1080 60 fps.
5. **After submission:** Crew Console C1–C5 (§9), reusing the `sim.js` engine as the baseline/anomaly core.
