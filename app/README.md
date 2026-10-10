# AstroDocX Crew Console

Offline-first PWA (React + TypeScript + Vite). Concept prototype, not a medical device.

```bash
npm install
npm run dev      # dev server
npm run build    # typecheck + production build (generates the service worker)
npm run preview  # serve the build to test install / offline
npm test         # unit, component and DB tests
npm run demo:snapshot   # after changing the engine or the data generator: regenerate the demo's precomputed output
```

Build phases: C12 Ground View (`src/ground`); C11 ship (served under `/app/`); C10 Ground sync (`src/sync`); C9 Simulator (`src/sim`); C8 Check-in (`src/checkin`); C7 Trends (`src/trends`); C6 Alerts + Action card (`src/alerts`); C5 Status Board (`src/board`). Demo mission seeds on first run.
