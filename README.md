# AstroDocX

**Astronaut + Doctor + X** — an offline-first health co-pilot for astronauts on long-duration missions.

> NASA Space Apps Challenge 2026 · Challenge: *Create Health Monitoring Software for Astronauts on Space Missions*
> Team AstroDocX · Dhaka, Bangladesh

![AstroDocX Health Twin](landing/assets/og-image.png)

## The problem
Long-duration missions expose astronauts to the five spaceflight hazards NASA groups as **RIDGE**:

- **R**adiation
- **I**solation and confinement
- **D**istance from Earth
- **G**ravity (altered)
- Hostile, closed **E**nvironments

These can bring immune changes, bone and muscle loss, cardiovascular events and behavioral health problems. Beyond the Moon, a message to Earth can take minutes each way, so the crew has to spot these changes in themselves and decide what to do.

## Our solution
AstroDocX learns each astronaut's **personal baseline**, spots drift early, and turns every alert into a **clear action** the crew can take on their own:

**Detect → Explain → Act → Log → Sync later**

| Module | What it does |
|---|---|
| Health Status Board | Five hazard tiles, each Nominal / Watch / Act, measured against the personal baseline |
| Explainable Alerts | States what changed, by how much, and since when |
| Action Cards | Step-by-step countermeasures; tapping Done logs the action |
| Daily Check-in | Mood, sleep and symptoms, plus a reaction-time test |
| Trend Charts | Each indicator plotted against the baseline band |
| Mission Simulator | Synthetic crew data plus events you can trigger, for the demo |
| Ground Sync | Outbox, simulated link windows and blackouts; log syncs to the ground when a window opens |

> **Status:** the landing page and the **Crew Console** (`app/`) are built. The console is an offline-first PWA (React, TypeScript, Dexie, Recharts) that runs the full loop on synthetic data: Status Board, Alerts + Action cards, Trends, Daily check-in with a reaction test, Mission Simulator and Ground Sync. See [`plan.md`](plan.md) for the build log. AstroDocX is a concept prototype, **not a medical device**; all thresholds not cited in the code are illustrative.

## Screenshots
| Hero | Health Twin | Mission Simulator |
|---|---|---|
| ![Hero](docs/screenshots/hero.jpg) | ![Health Twin](docs/screenshots/health-twin.jpg) | ![Mission Simulator](docs/screenshots/mission-simulator.jpg) |

## Try it
- **Health Twin:** scroll through the section. The scan runs head to feet, six system panels appear, Crew Readiness counts up, then the heart turns amber and an action card appears.
- **Mission Simulator (Live Demo):** inject a fault (CO₂ scrubber, solar event, poor sleep, skipped workout, comms blackout) or press *Play scenario*. Tick the action-card steps, press *Carry out & log*, then open the ground link window to sync the log.

## Links
- **Landing page:** _add Netlify URL_
- **Crew Console:** _add Netlify URL_`/app/`
- **Video:** _add video URL_
- **Repo:** https://github.com/A-42-018/AstroDocX

## Run locally
**Crew Console** (needs Node 22):

```bash
cd app
npm install
npm run dev      # http://localhost:5173/app/
npm test         # 100+ tests (engine, UI, DB)
npm run build && npm run preview   # production build with the service worker, to test install and offline
```

**Landing page** is a static site with no build step.

```bash
cd landing
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy (Netlify)
`netlify.toml` builds the console (`cd app && npm ci && npm run build`), copies it to `landing/app/`, and publishes `landing/`. So one site serves the landing page at `/` and the Crew Console PWA at `/app/` (with an SPA fallback). Connect the repo in Netlify and deploy.

## Tech
- HTML, CSS and vanilla JavaScript
- [Three.js r128](https://threejs.org/) for the nebula and 3D astronaut
- [GSAP 3.12 + ScrollTrigger](https://gsap.com/) for scroll animation
- Canvas 2D + SVG for the Health Twin (no extra WebGL context)
- Crew Console: React + TypeScript + Vite PWA, IndexedDB (Dexie), Zustand, Recharts, Vitest (simulated ground sync; Supabase is a stretch goal)

## Project structure
```
AstroDocX/
├── landing/        # landing page (static)
│   ├── index.html
│   ├── styles.css
│   ├── script.js   # nebula, pins, carousel, timeline, nav
│   ├── astronaut.js
│   ├── twin.js / twin.css    # Health Twin section
│   ├── sim.js / sim.css      # Live Mission Simulator (+ Built On reveal)
│   ├── built.css             # Built On section
│   ├── fonts/
│   └── assets/     # feature mockups, og-image
├── app/            # Crew Console PWA (React + TypeScript + Vite)
├── docs/           # design references + screenshots
├── plan.md         # roadmap
└── netlify.toml
```

## Data & references
- [NASA Human Research Program](https://www.nasa.gov/hrp/): the five hazards of human spaceflight (RIDGE)
- [NASA Open Science Data Repository (OSDR)](https://osdr.nasa.gov/)
- [NASA Twins Study](https://www.nasa.gov/twins-study/)
- [PhysioNet](https://physionet.org/): public physiological signals (ECG / HRV)

All values on the landing page and in the mockups are **sample data for illustration**.

## Credits
The visual theme (nebula, 3D astronaut, scroll system) is adapted from team lead Alif Mahmud's own portfolio template.

## License
[MIT](LICENSE)
