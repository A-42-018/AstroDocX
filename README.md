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
| Health Status Board | Readiness dial, Health Twin with one hotspot per hazard, next action, live vitals, and five hazard cards with their own mini chart, measured against the personal baseline |
| Explainable Alerts | List and detail: what changed, by how much, a chart of the trigger, and the alert's timeline |
| Action Cards | Step-by-step countermeasures; tapping Done logs the action |
| Daily Check-in | Four-step wizard: mood, sleep, symptoms and a reaction-time test |
| Trend Charts | A focus chart with stats and a crew-median overlay, plus all 11 indicators against their baseline bands |
| Mission Simulator | Mission control: scenarios, a time scrubber and a live feed of what the engine decided |
| Ground Sync | Animated ship, relay and Earth link, outbox of packets, simulated windows and blackouts, filterable log; syncs when a window opens |

> **Status:** the landing page and the **Crew Console** (`app/`) are built. The console is an offline-first PWA (React, TypeScript, Dexie, Recharts) that runs the full loop on synthetic data: Status Board, Alerts + Action cards, Trends, Daily check-in with a reaction test, Mission Simulator, Ground Sync and a flight-surgeon Ground View. See [`plan.md`](plan.md) for the build log. AstroDocX is a concept prototype, **not a medical device**; all thresholds not cited in the code are illustrative.

## Screenshots
**Landing page**

| Hero | Health Twin | Mission Simulator |
|---|---|---|
| ![Hero](docs/screenshots/hero.jpg) | ![Health Twin](docs/screenshots/health-twin.jpg) | ![Mission Simulator](docs/screenshots/mission-simulator.jpg) |

**Crew Console** (synthetic demo data, Flight Engineer selected)

![Mission Health board](docs/screenshots/console-board.jpg)

| Alerts | Trends |
|---|---|
| ![Alerts](docs/screenshots/console-alerts.jpg) | ![Trends](docs/screenshots/console-trends.jpg) |

| Check-in | Mission control |
|---|---|
| ![Check-in](docs/screenshots/console-checkin.jpg) | ![Simulator](docs/screenshots/console-simulator.jpg) |

![Ground Sync](docs/screenshots/console-sync.jpg)

The live waves on the board (ECG, pulse oximeter, breathing) are **simulated telemetry** built around the latest real readings; they never change alerts.

## Try it
- **Health Twin:** scroll through the section. The scan runs head to feet, six system panels appear, Crew Readiness counts up, then the heart turns amber and an action card appears.
- **Mission Simulator (Live Demo):** inject a fault (CO₂ scrubber, solar event, poor sleep, skipped workout, comms blackout) or press *Play scenario*. Tick the action-card steps, press *Carry out & log*, then open the ground link window to sync the log.

## Links
- **Landing page:** https://astrodocx.netlify.app
- **Crew Console:** https://astrodocx.netlify.app/app/
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

## Optional: real ground server (Supabase)
By default Ground Sync is simulated and nothing leaves the device. To upload synced log entries to a real server, create a Supabase project, run [`docs/supabase.sql`](docs/supabase.sql), copy `app/.env.example` to `app/.env.local` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then rebuild. Uploads happen only in link windows; a failed upload keeps entries queued like a blackout. The Ground View then reads from the server, so a flight surgeon can open `/app/ground` on another computer. **The provided policies are demo-grade (anonymous insert and read) and only suitable for synthetic data**; see the notes in the SQL file.

## Record the project video (tour mode)
Open the landing page with `?tour=1` (for example `http://localhost:8000/?tour=1`) and it scrolls itself from hero to footer at a steady pace, so a screen recording is smooth. The cursor and back-to-top button are hidden, and the Live Demo's *Play scenario* starts on its own. Options: `&speed=1.25` (faster), `&delay=5` (lead-in seconds). Keys: Space pause, R restart, Esc stop; any mouse wheel or touch also stops it. Default run is roughly 3 to 4 minutes; check the Space Apps video length rules and tune `PLAN` in `landing/tour.js`.

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
